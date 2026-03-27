import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check,  User, Mail, Lock, Calendar, Scale, Ruler } from 'lucide-react';
import "../Common.css";
import './RegistrationPage.css';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';


// Updated InfoBox component


const symptomOptions = [
  'Fatigue', 'Post-exertional malaise', 'Brain fog', 'Headaches', 
  'Shortness of breath', 'Heart palpitations', 'Dizziness', 'Joint/muscle pain',
  'Sleep disturbances', 'Temperature regulation issues', 'Digestive issues'
];

// Conversion utilities
const convertWeight = {
  lbsToKg: (lbs) => lbs * 0.453592,
  kgToLbs: (kg) => kg * 2.20462,
};

const convertHeight = {
  feetInchesToCm: (feet, inches) => (feet * 12 + inches) * 2.54,
  cmToFeetInches: (cm) => {
    const totalInches = cm / 2.54;
    const feet = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  },
};

function RegisterPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    age: '',
    gender: '',
    unitSystem: 'metric', // 'metric' or 'imperial'
    weight: '',
    height: '',
    heightFeet: '',
    heightInches: '',
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
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Handle unit system change
  const handleUnitSystemChange = (e) => {
    const newSystem = e.target.value;
    const oldSystem = formData.unitSystem;
    
    let updatedData = { unitSystem: newSystem };
    
    // Convert existing values if there are any
    if (formData.weight) {
      if (oldSystem === 'metric' && newSystem === 'imperial') {
        // Convert kg to lbs
        updatedData.weight = Math.round(convertWeight.kgToLbs(parseFloat(formData.weight)) * 10) / 10;
      } else if (oldSystem === 'imperial' && newSystem === 'metric') {
        // Convert lbs to kg
        updatedData.weight = Math.round(convertWeight.lbsToKg(parseFloat(formData.weight)) * 10) / 10;
      }
    }
    
    if (newSystem === 'imperial' && formData.height) {
      // Converting from metric to imperial
      const { feet, inches } = convertHeight.cmToFeetInches(parseFloat(formData.height));
      updatedData.heightFeet = feet;
      updatedData.heightInches = inches;
      updatedData.height = '';
    } else if (newSystem === 'metric' && (formData.heightFeet || formData.heightInches)) {
      // Converting from imperial to metric
      const feet = parseFloat(formData.heightFeet) || 0;
      const inches = parseFloat(formData.heightInches) || 0;
      updatedData.height = Math.round(convertHeight.feetInchesToCm(feet, inches));
      updatedData.heightFeet = '';
      updatedData.heightInches = '';
    }
    
    setFormData(prev => ({
      ...prev,
      ...updatedData
    }));
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep1()) {
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // Check if email already exists
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', formData.email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setErrors({ submit: 'An account with this email already exists' });
        setLoading(false);
        return;
      }

      // Create Firebase Auth user
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );

      // Convert height and weight to metric for storage (standardization)
      let weightInKg = formData.weight ? parseFloat(formData.weight) : null;
      let heightInCm = formData.height ? parseFloat(formData.height) : null;
      
      if (formData.unitSystem === 'imperial') {
        if (weightInKg) {
          weightInKg = convertWeight.lbsToKg(weightInKg);
        }
        if (formData.heightFeet || formData.heightInches) {
          const feet = parseFloat(formData.heightFeet) || 0;
          const inches = parseFloat(formData.heightInches) || 0;
          heightInCm = convertHeight.feetInchesToCm(feet, inches);
        }
      }

      // Save user data to Firestore
      const userData = {
        name: formData.name,
        email: formData.email.toLowerCase(),
        age: parseInt(formData.age),
        gender: formData.gender,
        unitSystem: formData.unitSystem,
        weight: weightInKg ? Math.round(weightInKg * 10) / 10 : null,
        height: heightInCm ? Math.round(heightInCm) : null,
        covidDate: formData.covidDate || null,
        covidDuration: formData.covidDuration || null,
        severity: formData.severity || null,
        symptoms: formData.symptoms,
        medicalConditions: formData.medicalConditions || null,
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);

      // Store user data in localStorage
      localStorage.setItem('userData', JSON.stringify({
        id: userCredential.user.uid,
        ...userData
      }));

      // Navigate to home page
      navigate('/');

    } catch (error) {
      console.error('Error during registration:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ submit: 'This email is already registered' });
      } else if (error.code === 'auth/weak-password') {
        setErrors({ submit: 'Password is too weak' });
      } else {
        setErrors({ submit: 'Registration failed. Please try again.' });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-container">
        <div className="register-content">
          <div className="register-header">
            <h1 className="register-title">Create Your Account</h1>
            <p className="register-subtitle">
              Join our Long COVID tracking community
            </p>
          </div>

          <div className="register-form-container">
            <form onSubmit={handleSubmit} className="register-form">
              <div className="form-sections">
                <div className="form-group">
                  <User className="form-label-icon" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`form-input ${errors.name ? 'error' : ''}`}
                    placeholder="Your full name"
                    autoComplete="name"
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
                  <label className="form-label">Gender *</label>
                  {errors.gender && <p className="error-message">{errors.gender}</p>}
                </div>

                {/* Unit System Selector */}
                <div className="form-group">
                  <select
                    name="unitSystem"
                    value={formData.unitSystem}
                    onChange={handleUnitSystemChange}
                    className="form-select"
                  >
                    <option value="metric">Metric (kg, cm)</option>
                    <option value="imperial">Imperial (lbs, ft/in)</option>
                  </select>
                  <label className="form-label">Measurement System</label>
                </div>

                {/* Weight Field - changes based on unit system */}
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
                  <label className="form-label">
                    Weight ({formData.unitSystem === 'metric' ? 'kg' : 'lbs'})
                  </label>
                </div>

                {/* Height Fields - different for metric vs imperial */}
                {formData.unitSystem === 'metric' ? (
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
                ) : (
                  <div className="form-grid two-cols">
                    <div className="form-group">
                      <Ruler className="form-label-icon" />
                      <input
                        type="number"
                        name="heightFeet"
                        value={formData.heightFeet}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Optional"
                        min="0"
                        max="8"
                      />
                      <label className="form-label">Height (feet)</label>
                    </div>
                    <div className="form-group">
                      <input
                        type="number"
                        name="heightInches"
                        value={formData.heightInches}
                        onChange={handleInputChange}
                        className="form-input"
                        placeholder="Optional"
                        min="0"
                        max="11"
                      />
                      <label className="form-label">Height (inches)</label>
                    </div>
                  </div>
                )}

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
