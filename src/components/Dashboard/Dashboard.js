import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../AuthContext';
import "../Common.css";
import './Dashboard.css';

function Dashboard() {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error during logout:', error);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="dashboard-container">
      <div className="bg-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
        <div className="floating-shape shape-4"></div>
        <div className="floating-shape shape-5"></div>
      </div>

      <div className="header">
        <h1>Energy Management Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {profile?.name || 'User'}! &nbsp;</span>
          <div className="user-actions">
            <button onClick={() => navigate('/personal-settings')} className="settings-btn">
              ⚙️ Settings
            </button>
            <button onClick={handleLogout} className="logout-btn">
              Logout
            </button>
          </div>
        </div>
        <div className="date" id="current-date">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
          })}
        </div>
      </div>

      <div className="dashboard">
        <div className="card status-summary-container quick-actions-card">
          <div className="card-glow"></div>
          <div className="card-content">
            <h3 className="card-title">
              Quick Actions
              <span className="info-icon" title="One-tap access to common activities for logging your day and managing your condition.">ⓘ</span>
            </h3>
            <div className="quick-actions">
              <button className="action-button meal" onClick={() => navigate('/food-tracker')}>
                📝 Track Meal
              </button>
              <button className="action-button symptom" onClick={() => navigate('/symptom-tracker')}>
                🩺 Track Symptoms
              </button>
              <button className="action-button patterns" onClick={() => navigate('/symptom-patterns')}>
                📊 Symptom Patterns
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
