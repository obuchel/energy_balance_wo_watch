import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, AlertCircle,  User, Mail, Lock, Calendar, Scale, Ruler } from 'lucide-react';
import "../Common.css";
import './RegistrationPage.css';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';


// Updated InfoBox component
const InfoBox = ({ title, children, icon: Icon }) => (
  <div className="info-box">
    <div className="info-box-content">
      {Icon && <Icon className="info-box-icon" />}
      <div>
        <h3 className="info-box-title">{title}</h3>
        <p className="info-box-text">{children}</p>
      </div>
    </div>
  </div>
);

const symptomOptions = [
  'Fatigue', 'Post-exertional malaise', 'Brain fog', 'Headaches', 
  'Shortness of breath', 'Heart palpitations', 'Dizziness', 'Joint/muscle pain',
  'Sleep disturbances', 'Temperature regulation issues', 'Digestive issues'
];

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
    weight: '',
    height: '',
    covidDate: '',
    covidDuration: '',
    severity: '',
    symptoms: [],
    medicalConditions: ''
  });
  
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // Floating label functionality
  React.useEffect(() => {
    const inputs = document.querySelectorAll('input, select, textarea');

    const handleFloatingLabels = (input) => {
      const formGroup = input.closest('.form-group');
      const label = formGroup?.querySelector('.form-label');
      
      if (!label || !formGroup) {
        return {
          handleFocus: () => {},
          handleBlur: () => {},
          handleInput: () => {},
          updateLabelState: () => {}
        };
      }

      const updateLabelState = () => {
        const hasValue = input.value && input.value.length > 0;
        const isFocused = document.activeElement === input;
        
        if (hasValue || isFocused) {
          label.classList.add('floating');
          formGroup.classList.add('has-content');
        } else {
          label.classList.remove('floating');
          formGroup.classList.remove('has-content');
        }
      };

      updateLabelState();

      const handleFocus = () => {
        try {
          if (input.closest('.form-group')) {
            input.closest('.form-group').style.transform = 'scale(1.02)';
          }
          label.classList.add('floating');
          formGroup.classList.add('focused');
          updateLabelState();
        } catch (error) {
          console.warn('Error in handleFocus:', error);
        }
      };
      
      const handleBlur = () => {
        try {
          if (input.closest('.form-group')) {
            input.closest('.form-group').style.transform = 'scale(1)';
          }
          formGroup.classList.remove('focused');
          updateLabelState();
        } catch (error) {
          console.warn('Error in handleBlur:', error);
        }
      };

      const handleInput = () => {
        try {
          updateLabelState();
        } catch (error) {
          console.warn('Error in handleInput:', error);
        }
      };

      return { handleFocus, handleBlur, handleInput, updateLabelState };
    };

    const inputHandlers = [];
    inputs.forEach(input => {
      try {
        const handlers = handleFloatingLabels(input);
        
        if (handlers && handlers.handleFocus) {
          input.addEventListener('focus', handlers.handleFocus);
          input.addEventListener('blur', handlers.handleBlur);
          input.addEventListener('input', handlers.handleInput);
          
          inputHandlers.push({ input, handlers });
        }
      } catch (error) {
        console.warn('Error setting up input handlers:', error);
      }
    });

    return () => {
      inputHandlers.forEach(({ input, handlers }) => {
        try {
          if (input && handlers) {
            input.removeEventListener('focus', handlers.handleFocus);
            input.removeEventListener('blur', handlers.handleBlur);
            input.removeEventListener('input', handlers.handleInput);
          }
        } catch (error) {
          console.warn('Error cleaning up input handlers:', error);
        }
      });
    };
  }, []);

  React.useEffect(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      try {
        const formGroup = input.closest('.form-group');
        const label = formGroup?.querySelector('.form-label');
        
        if (label && formGroup) {
          const hasValue = input.value && input.value.length > 0;
          
          if (hasValue) {
            label.classList.add('floating');
            formGroup.classList.add('has-content');
          } else {
            label.classList.remove('floating');
            formGroup.classList.remove('has-content');
          }
        }
      } catch (error) {
        console.warn('Error updating floating labels:', error);
      }
    });
  }, [formData]);

  // Validation
  const validateStep1 = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (formData.age < 13) {
      newErrors.age = 'Age must be at least 13';
    }
    
    if (!formData.gender) {
      newErrors.gender = 'Gender is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'symptoms') {
      setFormData(prev => ({
        ...prev,
        symptoms: checked 
          ? [...prev.symptoms, value]
          : prev.symptoms.filter(s => s !== value)
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Function to save user data to Firestore
  const saveUserToDatabase = async (user, userData = formData) => {
    try {
      const userProfile = {
        uid: user.uid,
        name: userData.name.trim(),
        email: userData.email.toLowerCase().trim(),
        age: parseInt(userData.age),
        gender: userData.gender,
        weight: userData.weight ? parseFloat(userData.weight) : null,
        height: userData.height ? parseFloat(userData.height) : null,
        covidDate: userData.covidDate || null,
        covidDuration: userData.covidDuration || null,
        severity: userData.severity || null,
        symptoms: userData.symptoms || [],
        medicalConditions: userData.medicalConditions || null,
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        energyProfile: {
          baselineCalculated: false,
          currentEnergyLevel: 50,
          energyEnvelope: null,
          dailyEnergyBudget: null
        },
        preferences: {
          notifications: true,
          reminderFrequency: 'daily',
          dataRetention: '1year'
        }
      };

      await setDoc(doc(db, 'users', user.uid), userProfile);
      console.log('User data saved successfully to Firestore');
      return userProfile;
    } catch (error) {
      console.error('Error saving user data to Firestore:', error);
      throw new Error('Failed to save user profile. Please try again.');
    }
  };

  // Check if email already exists
  const checkEmailExists = async (email) => {
    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      return !querySnapshot.empty;
    } catch (error) {
      console.error('Error checking email existence:', error);
      return false;
    }
  };

  // Handle registration submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep1()) {
      return;
    }
    
    setLoading(true);
    setErrors({});
    
    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      const cleanPassword = formData.password.trim();
      
      console.log('Starting registration process...');
      
      if (cleanPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid email address');
      }

      console.log('Checking email availability...');
      const emailExists = await checkEmailExists(cleanEmail);
      if (emailExists) {
        throw new Error('This email address is already registered. Please use a different email or try signing in.');
      }

      console.log('Creating Firebase Auth user...');
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        cleanEmail, 
        cleanPassword
      );
      
      const user = userCredential.user;
      console.log('Firebase Auth user created successfully:', user.uid);
      
      const updatedFormData = { ...formData, email: cleanEmail };
      
      console.log('Saving user data to Firestore...');
      await saveUserToDatabase(user, updatedFormData);
      
      console.log('Registration completed successfully');
      
      alert('Registration successful! Welcome to Energy Balance.');
      
      navigate('/login', { 
        state: { 
          message: 'Registration successful! Please sign in with your new account.',
          email: cleanEmail
        }
      });
      
    } catch (error) {
      console.error('Registration error:', error);
      
      let errorMessage = error.message || 'An error occurred during registration';
      
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email address is already registered. Please use a different email or try signing in.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address format.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      }
      
      setErrors({ submit: errorMessage });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="registration-page">
      <div className="registration-container">
        <div className="registration-header">
          <h1 className="registration-title">Join Energy Balance</h1>
          <p className="registration-subtitle">Set up your personalized energy management system</p>
        </div>

        <div className="bg-animation">
          <div className="floating-shape shape-1"></div>
          <div className="floating-shape shape-2"></div>
          <div className="floating-shape shape-3"></div>
        </div>
     
        <div className="registration-card fade-in-up">
          <div>
            <h2 className="step-title">Tell us about yourself</h2>
            
            <InfoBox title="Why we need this information" icon={AlertCircle}>
              Your personal details help our system calculate your energy baseline, recovery capacity, 
              and create a customized energy envelope specifically for your condition. All information 
              is stored securely and processed locally on your device.
            </InfoBox>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="form-grid two-cols">
                <div className="form-group">
                  <User className="form-label-icon" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="Enter your full name"
                  />
                  <label className="form-label">Full Name *</label>
                  {errors.name && <p className="error-message">{errors.name}</p>}
                </div>

                <div className="form-group">
                  <Mail className="form-label-icon" />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`form-input ${errors.email ? 'error' : ''}`}
                    placeholder="your@email.com"
                    autoComplete="email"
                  />
                  <label className="form-label">Email Address *</label>
                  {errors.email && <p className="error-message">{errors.email}</p>}
                </div>

                <div className="form-group">
                  <Lock className="form-label-icon" />
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className={`form-input ${errors.password ? 'error' : ''}`}
                    placeholder="Create a secure password"
                    autoComplete="new-password"
                  />
                  <label className="form-label">Create Password *</label>
                  {errors.password && <p className="error-message">{errors.password}</p>}
                </div>

                <div className="form-group">
                  <Lock className="form-label-icon" />
                  <input
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                    placeholder="Confirm your password"
                    autoComplete="new-password"
                  />
                  <label className="form-label">Confirm Password *</label>
                  {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
                </div>

                <div className="form-group">
                  <input
                    type="number"
                    name="age"
                    value={formData.age}
                    onChange={handleInputChange}
                    className={`form-input ${errors.age ? 'error' : ''}`}
                    placeholder="Your age"
                    min="13"
                    max="120"
                  />
                  <label className="form-label">Age *</label>
                  {errors.age && <p className="error-message">{errors.age}</p>}
                </div>

                <div className="form-group">
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    className={`form-select ${errors.gender ? 'error' : ''}`}
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                  <label className="form-label">Gender</label>
                  {errors.gender && <p className="error-message">{errors.gender}</p>}
                </div>

                <div className="form-group">
                  <Scale className="form-label-icon" />
                  <input
                    type="number"
                    name="weight"
                    value={formData.weight}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Optional"
                    step="0.1"
                  />
                  <label className="form-label">Weight (kg)</label>
                </div>

                <div className="form-group">
                  <Ruler className="form-label-icon" />
                  <input
                    type="number"
                    name="height"
                    value={formData.height}
                    onChange={handleInputChange}
                    className="form-input"
                    placeholder="Optional"
                  />
                  <label className="form-label">Height (cm)</label>
                </div>

                <div className="form-group">
                  <Calendar className="form-label-icon" />
                  <input
                    type="date"
                    name="covidDate"
                    value={formData.covidDate}
                    onChange={handleInputChange}
                    className="form-input"
                  />
                  <label className="form-label">When did you first get COVID?</label>
                </div>

                <div className="form-group">
                  <select
                    name="covidDuration"
                    value={formData.covidDuration}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Select duration</option>
                    <option value="less-than-1-month">Less than 1 month</option>
                    <option value="1-3-months">1-3 months</option>
                    <option value="3-6-months">3-6 months</option>
                    <option value="6-12-months">6-12 months</option>
                    <option value="1-2-years">1-2 years</option>
                    <option value="more-than-2-years">More than 2 years</option>
                  </select>
                  <label className="form-label">Long COVID Duration</label>
                </div>

                <div className="form-group">
                  <select
                    name="severity"
                    value={formData.severity}
                    onChange={handleInputChange}
                    className="form-select"
                  >
                    <option value="">Select severity</option>
                    <option value="mild">Mild</option>
                    <option value="moderate">Moderate</option>
                    <option value="severe">Severe</option>
                    <option value="very-severe">Very Severe</option>
                  </select>
                  <label className="form-label">COVID Severity</label>
                </div>
              </div>

              <div className="symptoms-section">
                <label className="form-label">
                  What symptoms do you experience? (Select all that apply)
                </label>
                <div className="symptoms-grid">
                  {symptomOptions.map((symptom) => (
                    <label
                      key={symptom}
                      className={`symptom-checkbox ${
                        formData.symptoms.includes(symptom) ? 'selected' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        name="symptoms"
                        value={symptom}
                        checked={formData.symptoms.includes(symptom)}
                        onChange={handleInputChange}
                        className="symptom-checkbox-input"
                      />
                      <span className="symptom-checkbox-text">{symptom}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <textarea
                  name="medicalConditions"
                  value={formData.medicalConditions}
                  onChange={handleInputChange}
                  className="form-textarea"
                  placeholder="Optional: List any pre-existing medical conditions..."
                  rows="4"
                />
                <label className="form-label">Pre-existing medical conditions</label>
              </div>

              {errors.submit && (
                <div className="error-message text-center">{errors.submit}</div>
              )}

              <div className="form-navigation">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => navigate('/login')}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="loading-spinner"></div>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <Check className="btn-icon" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

   


    </div>
  );
}

export default RegisterPage;