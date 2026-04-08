import React, { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from "../../firebase-config";
import "../Common.css";
import "./SignInPage.css";

function SignInPage() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const navigate  = useNavigate();
  const location  = useLocation();

  const registrationMessage = location.state?.message;
  const prefillEmail        = location.state?.email;

  useEffect(() => {
    if (prefillEmail) setEmail(prefillEmail);
  }, [prefillEmail]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const cleanEmail    = email.toLowerCase().trim();
      const cleanPassword = password.trim();

      if (!cleanEmail || !cleanPassword) {
        throw new Error('Please enter both email and password');
      }

      // Firebase Authentication — the only gate needed
      await signInWithEmailAndPassword(auth, cleanEmail, cleanPassword);

      // onAuthStateChanged in AuthContext fires automatically.
      // Navigate to the page the user was trying to reach, or dashboard.
      const destination = location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });

    } catch (err) {
      const codeMap = {
        'auth/user-not-found':      'No account found with this email. Please check or register first.',
        'auth/wrong-password':      'Incorrect password. Please try again.',
        'auth/invalid-credential':  'Invalid email or password.',
        'auth/invalid-email':       'Invalid email address format.',
        'auth/user-disabled':       'This account has been disabled. Please contact support.',
        'auth/too-many-requests':   'Too many failed attempts. Please wait a few minutes and try again.',
        'auth/network-request-failed': 'Network error. Please check your internet connection.',
        'auth/operation-not-allowed':  'Email/password sign-in is not enabled. Please contact support.',
      };
      setError(codeMap[err.code] || err.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signin-container animated-page-container">
      <div className="bg-animation">
        <div className="floating-shape shape-1"></div>
        <div className="floating-shape shape-2"></div>
        <div className="floating-shape shape-3"></div>
      </div>

      <div className="signin-card glass-card">
        <div className="glass-card-content">
          <div className="signin-header">
            <div className="logo-container">
              <div className="logo"></div>
            </div>
            <h1>Welcome</h1>
            <p>Sign in to your Energy Balance account</p>
          </div>

          {registrationMessage && (
            <div className="success-message">{registrationMessage}</div>
          )}

          {error && <div className="error-message">{error}</div>}

          <form className="signin-form" onSubmit={onSubmit}>
            <div className="form-group">
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
                autoComplete="email"
                className="form-input"
              />
              <label htmlFor="email" className="form-label">Email Address</label>
            </div>

            <div className="form-group">
              <input
                id="password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                minLength="6"
                className="form-input"
              />
              <label htmlFor="password" className="form-label">Password</label>
              <div className="forgot-password">
                <Link to="/login/forgot-password">Forgot your password?</Link>
              </div>
            </div>

            <button
              type="submit"
              className="signin-button btn btn-primary"
              disabled={loading}
            >
              {loading && <span className="loading-spinner-small"></span>}
              <span>{loading ? 'Signing in…' : 'Sign In'}</span>
            </button>
          </form>

          <div className="divider"></div>

          <div className="signup-link">
            Don't have an account? <Link to="/register">Sign up here</Link>
          </div>

          <div className="about-section">
            <h3>About Energy Balance</h3>
            <p>
              Energy Balance is a comprehensive health management system designed to help
              individuals recovering from Long COVID. Track your energy patterns through
              daily symptom monitoring and meal logging.
            </p>
            <p>
              By tracking consistently, you'll recognize patterns in your condition —
              identify triggers, understand your limits, and make informed decisions
              to better manage your energy and reduce symptom flares.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
