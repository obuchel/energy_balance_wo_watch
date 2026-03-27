import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegistrationPage from './components/Register/RegistrationPage';
import Dashboard from './components/Dashboard/Dashboard';
import SignInPage from './components/SignIn/SignInPage';
import ForgotPasswordPage from './components/SignIn/ForgotPasswordPage';
import PersonalSettings from './components/Settings/PersonalSettings';
import SymptomTracker from './components/SymptomTracker/SymptomTracker';
import SymptomPatterns from './components/SymptomPatterns/SymptomPatterns';
import './App.css';

// Lazy load Food Tracker component
const FoodTrackerPage = lazy(() => import('./components/FoodTracker/FoodTrackerPage'));

function App() {
  // Check if user is authenticated
  const isAuthenticated = () => {
    const userData = localStorage.getItem('userData');
    console.log('Checking authentication, userData exists:', !!userData);
    if (!userData) return false;
    
    try {
      const user = JSON.parse(userData);
      console.log('Parsed user ID:', user.id);
      return user && user.id;
    } catch (error) {
      console.error('Error parsing user data:', error);
      return false;
    }
  };

  // Protected Route component
  const ProtectedRoute = ({ children }) => {
    const isAuth = isAuthenticated();
    console.log('ProtectedRoute - isAuthenticated:', isAuth);
    return isAuth ? children : <Navigate to="/login" replace />;
  };

  // Public Route component (redirect to dashboard if already authenticated)
  const PublicRoute = ({ children }) => {
    const isAuth = isAuthenticated();
    console.log('PublicRoute - isAuthenticated:', isAuth);
    return !isAuth ? children : <Navigate to="/dashboard" replace />;
  };

  console.log('App rendering, checking routes...');

  return (
    <Router basename="/energy_balance_wo_watch">
      <div className="App">
        <Routes>
          {/* Public routes */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <SignInPage />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/forgot-password" 
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/login/forgot-password" 
            element={
              <PublicRoute>
                <ForgotPasswordPage />
              </PublicRoute>
            } 
          />
     
          <Route 
            path="/register" 
            element={
              <PublicRoute>
                <RegistrationPage />
              </PublicRoute>
            } 
          />
          
          {/* Protected routes */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/symptom-tracker" 
            element={
              <ProtectedRoute>
                <SymptomTracker />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/symptom-patterns" 
            element={
              <ProtectedRoute>
                <SymptomPatterns />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/food-tracker" 
            element={
              <ProtectedRoute>
                <Suspense fallback={<div>Loading...</div>}>
                  <FoodTrackerPage />
                </Suspense>
              </ProtectedRoute>
            } 
          />
          
          <Route 
            path="/personal-settings" 
            element={
              <ProtectedRoute>
                <PersonalSettings />
              </ProtectedRoute>
            } 
          />
          
          {/* Default route - redirect based on authentication status */}
          <Route 
            path="/" 
            element={
              isAuthenticated() ? 
                <Navigate to="/dashboard" replace /> : 
                <Navigate to="/login" replace />
            } 
          />
          
          {/* Catch all other routes */}
          <Route 
            path="*" 
            element={
              <div className="not-found">
                <h2>Page Not Found</h2>
                <p>The page you're looking for doesn't exist.</p>
                <p>Current path: {window.location.pathname}</p>
                <button onClick={() => window.location.href = '/'}>
                  Go Home
                </button>
              </div>
            } 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;