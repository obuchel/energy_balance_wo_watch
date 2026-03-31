
importScripts('https://cdn.jsdelivr.net/npm/fuse.js@7.0.0/dist/fuse.min.js');

let fuse = null;
let foodData = [];
let isIndexing = false;

// Optimized Fuse.js config for large datasets
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

        // Stream JSON in chunks to avoid memory spike
        const response = await fetch(payload.dataUrl);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let chunkCount = 0;

        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          chunkCount++;
          
          // Report progress every 10 chunks
          if (chunkCount % 10 === 0) {
            self.postMessage({ 
              type: 'INIT_PROGRESS', 
              payload: { chunks: chunkCount } 
            });
          }
        }

        // Parse complete JSON
        foodData = JSON.parse(buffer);
        buffer = null; // Free memory

        self.postMessage({ 
          type: 'INIT_PARSED', 
          payload: { count: foodData.length } 
        });

        // Build Fuse index
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
        
        // UPDATED: Split query into words for multi-word matching
        const words = query.split(/\s+/).filter(w => w.length >= 2);
        
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
                fuseScore: result.score
              });
            }
          });
        });
        
        // Convert to array and sort
        const processedResults = Array.from(resultMap.values())
          .sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();

            // Tier 1: Exact name match (e.g. "oats" → "oats")
            const exactA = nameA === query;
            const exactB = nameB === query;
            if (exactA !== exactB) return exactA ? -1 : 1;


            // Tier 2: Query is an exact comma-delimited segment of the name.
            // Handles FNDDS convention "Fish, salmon, raw" → "salmon" is a segment.
            // Ranks canonical plain forms above compound dishes like "Salmon salad".
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

            // Tier 3: Name contains the full query string somewhere
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
            searchMethod: 'fuse.js-worker-multiword',
            // Remove temporary fields
            fuseScore: undefined,
            wordMatches: undefined
          }));

        const searchTime = performance.now() - startTime;

        self.postMessage({ 
          type: 'SEARCH_RESULTS', 
          payload: { 
            results: processedResults,
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
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      payload: { message: error.message, stack: error.stack } 
    });
    isIndexing = false;
  }
};