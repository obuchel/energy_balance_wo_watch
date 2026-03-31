import { openDB } from 'idb';

const DB_NAME = 'FoodSearchDB';
const DB_VERSION = 1;
const STORE_NAME = 'foodData';
const DATA_KEY = 'allFoods';
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

// Create inline worker from blob
const createWorkerFromCode = (workerCode) => {
  const blob = new Blob([workerCode], { type: 'application/javascript' });
  return new Worker(URL.createObjectURL(blob));
};

// Worker code as string - UPDATED with multi-word search
const workerCode = `
importScripts('https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js');

let fuse = null;
let foodData = [];
let isIndexing = false;

const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 3 },
    { name: 'name_lower', weight: 2 },
    { name: 'search_tokens', weight: 2 },
    { name: 'category', weight: 1 }
  ],
  threshold: 0.35,
  distance: 80,
  minMatchCharLength: 2,
  includeScore: true,
  ignoreLocation: true,
  shouldSort: true,
  findAllMatches: false,
  useExtendedSearch: false
};

self.onmessage = async function(e) {
  const { type, payload } = e.data;

  try {
    switch(type) {
      case 'INIT':
        if (isIndexing) {
          self.postMessage({ type: 'ERROR', payload: { message: 'Already indexing' } });
          return;
        }

        isIndexing = true;
        self.postMessage({ type: 'INIT_STARTED' });

        const response = await fetch(payload.dataUrl);
        
        if (!response.ok) {
          throw new Error('Failed to fetch: ' + response.status + ' ' + response.statusText);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          chunkCount++;
          
          if (chunkCount % 10 === 0) {
            self.postMessage({ 
              type: 'INIT_PROGRESS', 
              payload: { chunks: chunkCount } 
            });
          }
        }

        foodData = JSON.parse(buffer);
        buffer = null;

        self.postMessage({ 
          type: 'INIT_PARSED', 
          payload: { count: foodData.length } 
        });

        fuse = new Fuse(foodData, FUSE_OPTIONS);
        isIndexing = false;

        self.postMessage({ 
          type: 'INIT_COMPLETE', 
          payload: { count: foodData.length } 
        });
        break;

      case 'SEARCH':
        if (!fuse) {
          self.postMessage({ 
            type: 'ERROR', 
            payload: { message: 'Not initialized' } 
          });
          return;
        }

        const startTime = performance.now();
        const query = payload.query.toLowerCase().trim();
        const maxResults = payload.maxResults || 100;
        
        // UPDATED: Split query into words for better multi-word matching
        const words = query.split(/\\s+/).filter(w => w.length >= 2);
        
        if (words.length === 0) {
          self.postMessage({ 
            type: 'SEARCH_RESULTS', 
            payload: { 
              results: [],
              searchTime: '0',
              query: payload.query
            } 
          });
          return;
        }
        
        // Search for each word and combine results
        const resultMap = new Map();
        
        words.forEach(word => {
          const wordResults = fuse.search(word, { limit: maxResults * 2 });
          
          wordResults.forEach(result => {
            const id = result.item.id || result.item.name;
            
            if (resultMap.has(id)) {
              // Item already found - increase word match count
              const existing = resultMap.get(id);
              existing.wordMatches++;
              // Keep the best score
              if (result.score < existing.fuseScore) {
                existing.fuseScore = result.score;
              }
            } else {
              // New item
              resultMap.set(id, {
                ...result.item,
                wordMatches: 1,
                fuseScore: result.score,
                searchMethod: 'fuse.js-worker-multiword'
              });
            }
          });
        });
        
        // Convert to array and sort
        const combinedResults = Array.from(resultMap.values())
          .sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();

            // Tier 1: Exact name match
            const exactA = nameA === query;
            const exactB = nameB === query;
            if (exactA !== exactB) return exactA ? -1 : 1;

            // Tier 2: Query is an exact comma-delimited segment of the name.
            const segA = nameA.split(',').some(seg => seg.trim() === query);
            const segB = nameB.split(',').some(seg => seg.trim() === query);
            if (segA !== segB) return segA ? -1 : 1;

            // Tier 3: Name starts with the full query
            const startsA = nameA.startsWith(query);
            const startsB = nameB.startsWith(query);
            if (startsA !== startsB) return startsA ? -1 : 1;

            // Tier 3b: starts with query AND next char is a word boundary
            // e.g. "apple" → "Apple, raw" ranks above "Applesauce"
            const wbA = startsA && (nameA.length === query.length || /[^a-z]/i.test(nameA[query.length]));
            const wbB = startsB && (nameB.length === query.length || /[^a-z]/i.test(nameB[query.length]));
            if (wbA !== wbB) return wbA ? -1 : 1;

            // Tier 3: Name contains the full query string
            const containsA = nameA.includes(query);
            const containsB = nameB.includes(query);
            if (containsA !== containsB) return containsA ? -1 : 1;

            // Tier 4: Items matching more query words come first
            if (b.wordMatches !== a.wordMatches) {
              return b.wordMatches - a.wordMatches;
            }
            // Tier 5: Better Fuse score
            return a.fuseScore - b.fuseScore;
          })
          .slice(0, maxResults)
          .map(item => ({
            ...item,
            searchScore: (1 - item.fuseScore) * 100,
            // Remove temporary fields
            fuseScore: undefined,
            wordMatches: undefined
          }));

        const searchTime = performance.now() - startTime;

        self.postMessage({ 
          type: 'SEARCH_RESULTS', 
          payload: { 
            results: combinedResults,
            searchTime: searchTime.toFixed(2),
            query: payload.query
          } 
        });
        break;

      case 'GET_ALL':
        self.postMessage({ 
          type: 'ALL_FOODS', 
          payload: { foods: foodData } 
        });
        break;
      default:
        self.postMessage({
          type: 'ERROR',
          payload: { message: 'Unknown message type: ' + type }
        });
        break;
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      payload: { message: error.message, stack: error.stack } 
    });
    isIndexing = false;
  }
};
`;

class FoodSearchService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.initPromise = null;
    this.searchCache = new Map();
    this.maxCacheSize = 100;
    this.db = null;
  }

  async initDB() {
    this.db = await openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
    });
  }

  async getCachedData() {
    if (!this.db) await this.initDB();
    
    try {
      const cached = await this.db.get(STORE_NAME, DATA_KEY);
      
      if (cached && cached.timestamp) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION) {
          console.log('✅ Using IndexedDB cached data (age:', Math.round(age / 1000 / 60), 'minutes)');
          return cached.data;
        }
      }
    } catch (error) {
      console.warn('IndexedDB read failed:', error);
    }
    
    return null;
  }

  async cacheData(data) {
    if (!this.db) await this.initDB();
    
    try {
      await this.db.put(STORE_NAME, {
        data,
        timestamp: Date.now()
      }, DATA_KEY);
      console.log('✅ Cached', data.length, 'items to IndexedDB');
    } catch (error) {
      console.warn('IndexedDB write failed:', error);
    }
  }

  async initialize(dataUrl = '/energy_balance_wo_watch/food_updated.json') {
    if (this.initPromise) return this.initPromise;
    if (this.isReady) return Promise.resolve();

    this.initPromise = (async () => {
      try {
        console.log('🚀 Initializing Food Search Service...');
        
        const cachedData = await this.getCachedData();
        
        // Create ABSOLUTE URL for worker
        const absoluteUrl = new URL(dataUrl, window.location.origin).href;
        console.log('📍 Loading from:', absoluteUrl);
        
        // Create inline worker
        this.worker = createWorkerFromCode(workerCode);
        
        const workerReady = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Worker initialization timeout'));
          }, 60000);

          this.worker.onmessage = (e) => {
            const { type, payload } = e.data;
            
            switch(type) {
              case 'INIT_STARTED':
                console.log('📦 Loading JSON file...');
                break;
                
              case 'INIT_PROGRESS':
                console.log('📊 Progress: Loaded', payload.chunks, 'chunks');
                break;
                
              case 'INIT_PARSED':
                console.log('✅ Parsed', payload.count, 'food items');
                break;
                
              case 'INIT_COMPLETE':
                clearTimeout(timeout);
                console.log('✅ Search index ready!');
                this.isReady = true;
                resolve();
                break;
                
              case 'ERROR':
                clearTimeout(timeout);
                console.error('❌ Worker error:', payload.message);
                reject(new Error(payload.message));
                break;
              default:
                // Ignore unknown message types during initialisation
                break;
            }
          };

          this.worker.onerror = (error) => {
            clearTimeout(timeout);
            console.error('❌ Worker error:', error);
            reject(error);
          };
        });

        this.worker.postMessage({ 
          type: 'INIT', 
          payload: { dataUrl: absoluteUrl }
        });

        await workerReady;

        if (!cachedData) {
          this.worker.postMessage({ type: 'GET_ALL' });
          this.worker.addEventListener('message', async (e) => {
            if (e.data.type === 'ALL_FOODS') {
              await this.cacheData(e.data.payload.foods);
            }
          }, { once: true });
        }

      } catch (error) {
        console.error('Failed to initialize search service:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  search(query, maxResults = 100) {
    return new Promise((resolve, reject) => {
      if (!this.isReady || !this.worker) {
        console.warn('Search service not ready');
        resolve([]);
        return;
      }

      if (!query || query.length < 2) {
        resolve([]);
        return;
      }

      const cacheKey = `${query}-${maxResults}`;
      if (this.searchCache.has(cacheKey)) {
        console.log('💾 Cache hit for:', query);
        resolve(this.searchCache.get(cacheKey));
        return;
      }

      const handleMessage = (e) => {
        if (e.data.type === 'SEARCH_RESULTS' && e.data.payload.query === query) {
          this.worker.removeEventListener('message', handleMessage);
          
          const results = e.data.payload.results;
          console.log(`🔍 Found ${results.length} results in ${e.data.payload.searchTime}ms`);
          
          this.searchCache.set(cacheKey, results);
          
          if (this.searchCache.size > this.maxCacheSize) {
            const firstKey = this.searchCache.keys().next().value;
            this.searchCache.delete(firstKey);
          }
          
          resolve(results);
        } else if (e.data.type === 'ERROR') {
          this.worker.removeEventListener('message', handleMessage);
          reject(new Error(e.data.payload.message));
        }
      };

      this.worker.addEventListener('message', handleMessage);

      this.worker.postMessage({ 
        type: 'SEARCH', 
        payload: { query, maxResults } 
      });

      setTimeout(() => {
        this.worker.removeEventListener('message', handleMessage);
        reject(new Error('Search timeout'));
      }, 5000);
    });
  }

  clearCache() {
    this.searchCache.clear();
    console.log('🗑️ Search cache cleared');
  }

  async clearStoredCache() {
    if (!this.db) await this.initDB();
    await this.db.delete(STORE_NAME, DATA_KEY);
    console.log('🗑️ IndexedDB cache cleared');
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
      console.log('🛑 Worker terminated');
    }
  }
}

const foodSearchService = new FoodSearchService();
export default foodSearchService;