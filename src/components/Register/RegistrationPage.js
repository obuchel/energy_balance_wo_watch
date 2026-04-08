import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, User, Mail, Lock, Calendar, Scale, Ruler } from 'lucide-react';
import "../Common.css";
import './RegistrationPage.css';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase-config';
import { collection, query, where, getDocs, doc, setDoc } from 'firebase/firestore';

const symptomGroups = [
  { label: 'Energy & Exertion',            symptoms: ['Fatigue', 'Post-exertional malaise'] },
  { label: 'Neurological',                  symptoms: ['Brain fog', 'Headaches', 'Dizziness'] },
  { label: 'Cardiovascular & Respiratory', symptoms: ['Shortness of breath', 'Heart palpitations'] },
  { label: 'Physical',                      symptoms: ['Joint/muscle pain', 'Temperature regulation issues'] },
  { label: 'Other',                         symptoms: ['Sleep disturbances', 'Digestive issues'] },
];

// ── Comorbid conditions ─────────────────────────────────────────────────────
const COMORBID_CONDITIONS = [
  {
    id: 'mecfs',
    label: 'ME/CFS',
    fullName: 'Myalgic Encephalomyelitis / Chronic Fatigue Syndrome',
    icon: '🧠',
    note: 'Characterised by post-exertional malaise, unrefreshing sleep, and cognitive impairment.',
  },
  {
    id: 'pots',
    label: 'POTS',
    fullName: 'Postural Orthostatic Tachycardia Syndrome',
    icon: '💓',
    note: 'Abnormal heart-rate increase on standing; often causes dizziness and palpitations.',
  },
  {
    id: 'mcas',
    label: 'MCAS',
    fullName: 'Mast Cell Activation Syndrome',
    icon: '🌡️',
    note: 'Mast cells release chemicals inappropriately, triggering allergy-like reactions.',
  },
  {
    id: 'fibro',
    label: 'Fibromyalgia',
    fullName: 'Fibromyalgia',
    icon: '🦴',
    note: 'Widespread musculoskeletal pain, fatigue, and often cognitive difficulties.',
  },
  {
    id: 'eds',
    label: 'EDS',
    fullName: 'Ehlers-Danlos Syndrome',
    icon: '🔗',
    note: 'Connective tissue disorder; hypermobility, joint instability, and chronic pain.',
  },
];

const CONDITION_LEVELS = [
  { value: 'mild',       label: 'Mild',       icon: '🟡' },
  { value: 'moderate',   label: 'Moderate',   icon: '🟠' },
  { value: 'severe',     label: 'Severe',     icon: '🔴' },
  { value: 'very-severe', label: 'Very Severe', icon: '🟣' },
];
// ───────────────────────────────────────────────────────────────────────────

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
    unitSystem: 'metric',
    weight: '',
    height: '',
    heightFeet: '',
    heightInches: '',
    covidDate: '',
    covidDuration: '',
    severity: '',
    symptoms: [],
    comorbidConditions: {},   // { mecfs: 'moderate', pots: 'mild', … }
    medicalConditions: '',
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
        return { handleFocus: () => {}, handleBlur: () => {}, handleInput: () => {}, updateLabelState: () => {} };
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
          if (input.closest('.form-group')) input.closest('.form-group').style.transform = 'scale(1.02)';
          label.classList.add('floating');
          formGroup.classList.add('focused');
          updateLabelState();
        } catch (error) { console.warn('Error in handleFocus:', error); }
      };

      const handleBlur = () => {
        try {
          if (input.closest('.form-group')) input.closest('.form-group').style.transform = 'scale(1)';
          formGroup.classList.remove('focused');
          updateLabelState();
        } catch (error) { console.warn('Error in handleBlur:', error); }
      };

      const handleInput = () => {
        try { updateLabelState(); } catch (error) { console.warn('Error in handleInput:', error); }
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
      } catch (error) { console.warn('Error setting up input handlers:', error); }
    });

    return () => {
      inputHandlers.forEach(({ input, handlers }) => {
        try {
          if (input && handlers) {
            input.removeEventListener('focus', handlers.handleFocus);
            input.removeEventListener('blur', handlers.handleBlur);
            input.removeEventListener('input', handlers.handleInput);
          }
        } catch (error) { console.warn('Error cleaning up input handlers:', error); }
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
          if (hasValue) { label.classList.add('floating'); formGroup.classList.add('has-content'); }
          else { label.classList.remove('floating'); formGroup.classList.remove('has-content'); }
        }
      } catch (error) { console.warn('Error updating floating labels:', error); }
    });
  }, [formData]);

  // Validation
  const validateStep1 = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Invalid email format';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    if (!formData.age) newErrors.age = 'Age is required';
    else if (formData.age < 13) newErrors.age = 'Age must be at least 13';
    if (!formData.gender) newErrors.gender = 'Gender is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'symptoms') {
      setFormData(prev => ({
        ...prev,
        symptoms: checked ? [...prev.symptoms, value] : prev.symptoms.filter(s => s !== value),
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    }
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ── Comorbid condition handlers ────────────────────────────────────────
  const handleConditionToggle = (conditionId) => {
    setFormData(prev => {
      const updated = { ...prev.comorbidConditions };
      if (conditionId in updated) {
        delete updated[conditionId];
      } else {
        updated[conditionId] = 'moderate'; // sensible default
      }
      return { ...prev, comorbidConditions: updated };
    });
  };

  const handleConditionLevel = (conditionId, level) => {
    setFormData(prev => ({
      ...prev,
      comorbidConditions: { ...prev.comorbidConditions, [conditionId]: level },
    }));
  };
  // ──────────────────────────────────────────────────────────────────────

  // Handle unit system change
  const handleUnitSystemChange = (e) => {
    const newSystem = e.target.value;
    const oldSystem = formData.unitSystem;
    let updatedData = { unitSystem: newSystem };

    if (formData.weight) {
      if (oldSystem === 'metric' && newSystem === 'imperial') updatedData.weight = Math.round(convertWeight.kgToLbs(parseFloat(formData.weight)) * 10) / 10;
      else if (oldSystem === 'imperial' && newSystem === 'metric') updatedData.weight = Math.round(convertWeight.lbsToKg(parseFloat(formData.weight)) * 10) / 10;
    }

    if (newSystem === 'imperial' && formData.height) {
      const { feet, inches } = convertHeight.cmToFeetInches(parseFloat(formData.height));
      updatedData.heightFeet = feet;
      updatedData.heightInches = inches;
      updatedData.height = '';
    } else if (newSystem === 'metric' && (formData.heightFeet || formData.heightInches)) {
      updatedData.height = Math.round(convertHeight.feetInchesToCm(parseFloat(formData.heightFeet) || 0, parseFloat(formData.heightInches) || 0));
      updatedData.heightFeet = '';
      updatedData.heightInches = '';
    }

    setFormData(prev => ({ ...prev, ...updatedData }));
  };

  // Submit handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep1()) return;

    setLoading(true);
    setErrors({});

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', formData.email.toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        setErrors({ submit: 'An account with this email already exists' });
        setLoading(false);
        return;
      }

      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);

      let weightInKg = formData.weight ? parseFloat(formData.weight) : null;
      let heightInCm = formData.height ? parseFloat(formData.height) : null;

      if (formData.unitSystem === 'imperial') {
        if (weightInKg) weightInKg = convertWeight.lbsToKg(weightInKg);
        if (formData.heightFeet || formData.heightInches) {
          heightInCm = convertHeight.feetInchesToCm(parseFloat(formData.heightFeet) || 0, parseFloat(formData.heightInches) || 0);
        }
      }

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
        comorbidConditions: formData.comorbidConditions,   // ← new field
        medicalConditions: formData.medicalConditions || null,
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), userData);
      localStorage.setItem('userData', JSON.stringify({ id: userCredential.user.uid, ...userData }));
      navigate('/');

    } catch (error) {
      console.error('Error during registration:', error);
      if (error.code === 'auth/email-already-in-use') setErrors({ submit: 'This email is already registered' });
      else if (error.code === 'auth/weak-password') setErrors({ submit: 'Password is too weak' });
      else setErrors({ submit: 'Registration failed. Please try again.' });
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
            <p className="register-subtitle">Join our Long COVID tracking community</p>
          </div>

          <div className="register-form-container">
            <form onSubmit={handleSubmit} className="register-form">
              <div className="form-sections">

                {/* ── Account credentials ── */}
                <div className="form-group">
                  <User className="form-label-icon" />
                  <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                    className={`form-input ${errors.name ? 'error' : ''}`} placeholder="Your full name" autoComplete="name" />
                  <label className="form-label">Full Name *</label>
                  {errors.name && <p className="error-message">{errors.name}</p>}
                </div>

                <div className="form-group">
                  <Mail className="form-label-icon" />
                  <input type="email" name="email" value={formData.email} onChange={handleInputChange}
                    className={`form-input ${errors.email ? 'error' : ''}`} placeholder="your@email.com" autoComplete="email" />
                  <label className="form-label">Email Address *</label>
                  {errors.email && <p className="error-message">{errors.email}</p>}
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <Lock className="form-label-icon" />
                    <input type="password" name="password" value={formData.password} onChange={handleInputChange}
                      className={`form-input ${errors.password ? 'error' : ''}`} placeholder="Min 6 characters" autoComplete="new-password" />
                    <label className="form-label">Password *</label>
                    {errors.password && <p className="error-message">{errors.password}</p>}
                  </div>
                  <div className="form-group">
                    <Lock className="form-label-icon" />
                    <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleInputChange}
                      className={`form-input ${errors.confirmPassword ? 'error' : ''}`} placeholder="Repeat password" autoComplete="new-password" />
                    <label className="form-label">Confirm Password *</label>
                    {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
                  </div>
                </div>

                {/* ── Demographics ── */}
                <div className="form-section-divider">About You</div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <input type="number" name="age" value={formData.age} onChange={handleInputChange}
                      className={`form-input ${errors.age ? 'error' : ''}`} placeholder="Your age" min="13" max="120" />
                    <label className="form-label">Age *</label>
                    {errors.age && <p className="error-message">{errors.age}</p>}
                  </div>
                  <div className="form-group">
                    <select name="gender" value={formData.gender} onChange={handleInputChange}
                      className={`form-select ${errors.gender ? 'error' : ''}`}>
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                    <label className="form-label">Gender *</label>
                    {errors.gender && <p className="error-message">{errors.gender}</p>}
                  </div>
                </div>

                {/* ── Body measurements ── */}
                <div className="form-section-divider">Body Measurements <span>(optional)</span></div>
                <div className="form-row form-row-3">
                  <div className="form-group">
                    <select name="unitSystem" value={formData.unitSystem} onChange={handleUnitSystemChange} className="form-select">
                      <option value="metric">Metric (kg, cm)</option>
                      <option value="imperial">Imperial (lbs, ft/in)</option>
                    </select>
                    <label className="form-label">Units</label>
                  </div>

                  <div className="form-group">
                    <Scale className="form-label-icon" />
                    <input type="number" name="weight" value={formData.weight} onChange={handleInputChange}
                      className="form-input" placeholder="Optional" step="0.1" />
                    <label className="form-label">Weight ({formData.unitSystem === 'metric' ? 'kg' : 'lbs'})</label>
                  </div>

                  {formData.unitSystem === 'metric' ? (
                    <div className="form-group">
                      <Ruler className="form-label-icon" />
                      <input type="number" name="height" value={formData.height} onChange={handleInputChange}
                        className="form-input" placeholder="Optional" />
                      <label className="form-label">Height (cm)</label>
                    </div>
                  ) : (
                    <div className="form-row form-row-2 form-row-nested">
                      <div className="form-group">
                        <Ruler className="form-label-icon" />
                        <input type="number" name="heightFeet" value={formData.heightFeet} onChange={handleInputChange}
                          className="form-input height-feet" placeholder="ft" min="0" max="8" />
                        <label className="form-label">Feet</label>
                      </div>
                      <div className="form-group">
                        <input type="number" name="heightInches" value={formData.heightInches} onChange={handleInputChange}
                          className="form-input height-inches" placeholder="in" min="0" max="11" />
                        <label className="form-label">Inches</label>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Condition history ── */}
                <div className="form-section-divider">Condition History</div>
                <div className="form-row form-row-2">
                  <div className="form-group">
                    <Calendar className="form-label-icon" />
                    <input type="date" name="covidDate" value={formData.covidDate} onChange={handleInputChange} className="form-input" />
                    <label className="form-label">When did you first get COVID?</label>
                  </div>
                  <div className="form-group">
                    <select name="covidDuration" value={formData.covidDuration} onChange={handleInputChange} className="form-select">
                      <option value="">Select duration</option>
                      <option value="less-than-1-month">Less than 1 month</option>
                      <option value="1-3-months">1–3 months</option>
                      <option value="3-6-months">3–6 months</option>
                      <option value="6-12-months">6–12 months</option>
                      <option value="1-2-years">1–2 years</option>
                      <option value="more-than-2-years">More than 2 years</option>
                    </select>
                    <label className="form-label">Long COVID Duration</label>
                  </div>
                </div>

                {/* Severity — radio cards */}
                <div className="form-group severity-group">
                  <p className="severity-group-label">
                    Long COVID Severity
                    <span className="severity-group-note">Select the option that best describes your <em>typical</em> day.</span>
                  </p>
                  <div className="severity-cards">
                    {[
                      { value: 'mild',       label: 'Mild',       icon: '🟡', definition: 'Able to carry out most daily activities with minor adjustments. Symptoms are present but do not prevent work, study, or self-care. Some days are harder than others.' },
                      { value: 'moderate',   label: 'Moderate',   icon: '🟠', definition: 'Significant reduction in activity compared to before illness. Unable to sustain full-time work or study. Symptoms worsen after exertion (PEM). Housebound on some days.' },
                      { value: 'severe',     label: 'Severe',     icon: '🔴', definition: 'Mostly housebound. Unable to work. Substantial cognitive and physical limitations most days. Light activity causes symptom flares that take hours or days to recover from.' },
                      { value: 'very-severe', label: 'Very Severe', icon: '🟣', definition: 'Largely or fully bedbound. Dependent on others for basic needs. Very sensitive to light, sound, or touch. Even minimal activity causes significant and prolonged worsening of symptoms.' },
                    ].map(({ value, label, icon, definition }) => (
                      <label key={value} className={`severity-card ${formData.severity === value ? 'selected' : ''}`}>
                        <input type="radio" name="severity" value={value} checked={formData.severity === value}
                          onChange={handleInputChange} className="severity-radio-input" />
                        <span className="severity-card-header">
                          <span className="severity-icon">{icon}</span>
                          <span className="severity-label">{label}</span>
                        </span>
                        <span className="severity-definition">{definition}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* ── Comorbid conditions ── */}
                <div className="form-section-divider">
                  Related Conditions <span>(select all that apply — or none)</span>
                </div>
                <div className="comorbid-conditions-section">
                  {COMORBID_CONDITIONS.map(condition => {
                    const isSelected = condition.id in formData.comorbidConditions;
                    const currentLevel = formData.comorbidConditions[condition.id];
                    return (
                      <div key={condition.id} className={`comorbid-card ${isSelected ? 'selected' : ''}`}>
                        <button
                          type="button"
                          className="comorbid-card-header"
                          onClick={() => handleConditionToggle(condition.id)}
                          aria-pressed={isSelected}
                        >
                          <span className="comorbid-icon" aria-hidden="true">{condition.icon}</span>
                          <span className="comorbid-info">
                            <span className="comorbid-label">{condition.label}</span>
                            <span className="comorbid-full-name">{condition.fullName}</span>
                          </span>
                          <span className={`comorbid-check ${isSelected ? 'checked' : ''}`} aria-hidden="true">
                            {isSelected ? <Check size={13} /> : '+'}
                          </span>
                        </button>

                        {isSelected && (
                          <div className="comorbid-body">
                            <p className="comorbid-note">{condition.note}</p>
                            <div className="comorbid-level-label">Severity level:</div>
                            <div className="comorbid-level-row">
                              {CONDITION_LEVELS.map(level => (
                                <button
                                  key={level.value}
                                  type="button"
                                  className={`comorbid-level-btn ${currentLevel === level.value ? 'active' : ''}`}
                                  onClick={() => handleConditionLevel(condition.id, level.value)}
                                >
                                  <span className="clb-icon">{level.icon}</span>
                                  <span className="clb-label">{level.label}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

              </div>{/* /form-sections */}

              {/* ── Symptoms ── */}
              <div className="symptoms-section">
                <label className="form-label">What symptoms do you experience? (Select all that apply)</label>
                {symptomGroups.map((group) => (
                  <div key={group.label} className="symptom-group">
                    <p className="symptom-group-label">{group.label}</p>
                    <div className="symptoms-grid" style={{ gridTemplateColumns: `repeat(${group.symptoms.length}, 1fr)` }}>
                      {group.symptoms.map((symptom) => (
                        <label key={symptom} className={`symptom-checkbox ${formData.symptoms.includes(symptom) ? 'selected' : ''}`}>
                          <input type="checkbox" name="symptoms" value={symptom}
                            checked={formData.symptoms.includes(symptom)} onChange={handleInputChange}
                            className="symptom-checkbox-input" />
                          <span className="symptom-checkbox-text">{symptom}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="form-group">
                <textarea name="medicalConditions" value={formData.medicalConditions} onChange={handleInputChange}
                  className="form-textarea" placeholder="Optional: List any pre-existing medical conditions..." rows="4" />
                <label className="form-label">Pre-existing medical conditions</label>
              </div>

              {errors.submit && <div className="error-message text-center">{errors.submit}</div>}

              <div className="form-navigation">
                <button type="button" className="btn btn-secondary" onClick={() => navigate('/login')}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? (
                    <><div className="loading-spinner"></div>Creating Account...</>
                  ) : (
                    <>Create Account<Check className="btn-icon" /></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        /* ── Severity cards ── */
        .severity-group { margin-bottom: 1.25rem; }
        .severity-group-label {
          font-size: 0.9rem; font-weight: 600; color: #374151;
          margin: 0 0 0.5rem 0; display: flex; flex-direction: column; gap: 3px;
        }
        .severity-group-note { font-size: 0.78rem; font-weight: 400; color: #6b7280; }
        .severity-cards { display: flex; flex-direction: column; gap: 0.5rem; }
        .severity-card {
          display: flex; flex-direction: column; gap: 4px;
          padding: 12px 14px; border: 2px solid #e5e7eb; border-radius: 10px;
          cursor: pointer; transition: border-color 0.15s ease, background 0.15s ease;
          background: #fff; position: relative;
        }
        .severity-card:hover { border-color: #93c5fd; background: #f0f9ff; }
        .severity-card.selected { border-color: #3b82f6; background: #eff6ff; }
        .severity-radio-input { position: absolute; opacity: 0; width: 0; height: 0; }
        .severity-card-header { display: flex; align-items: center; gap: 8px; }
        .severity-icon { font-size: 1rem; line-height: 1; }
        .severity-label { font-weight: 600; font-size: 0.9rem; color: #111827; }
        .severity-card.selected .severity-label { color: #1d4ed8; }
        .severity-definition { font-size: 0.8rem; color: #4b5563; line-height: 1.45; padding-left: 1.75rem; }

        /* ── Comorbid conditions ── */
        .comorbid-conditions-section {
          display: flex;
          flex-direction: column;
          gap: 0.625rem;
        }

        .comorbid-card {
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .comorbid-card.selected {
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.12);
        }

        .comorbid-card-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .comorbid-card-header:hover { background: #f8faff; }
        .comorbid-card.selected .comorbid-card-header { background: #eff6ff; }

        .comorbid-icon { font-size: 1.25rem; flex-shrink: 0; line-height: 1; }

        .comorbid-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .comorbid-label {
          font-size: 0.925rem;
          font-weight: 700;
          color: #111827;
          line-height: 1.2;
        }

        .comorbid-card.selected .comorbid-label { color: #1d4ed8; }

        .comorbid-full-name {
          font-size: 0.775rem;
          color: #6b7280;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .comorbid-check {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          border: 2px solid #d1d5db;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 0.85rem;
          color: #9ca3af;
          transition: all 0.15s ease;
        }

        .comorbid-check.checked {
          background: #3b82f6;
          border-color: #3b82f6;
          color: #fff;
        }

        /* Expanded body */
        .comorbid-body {
          padding: 0.75rem 1rem 1rem;
          border-top: 1px solid #dbeafe;
          background: #f8fbff;
          animation: slideInUp 0.2s ease-out;
        }

        .comorbid-note {
          font-size: 0.8rem;
          color: #4b5563;
          line-height: 1.5;
          margin: 0 0 0.75rem 0;
        }

        .comorbid-level-label {
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #6b7280;
          margin-bottom: 0.4rem;
        }

        .comorbid-level-row {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .comorbid-level-btn {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          padding: 0.35rem 0.7rem;
          border: 2px solid #e5e7eb;
          border-radius: 8px;
          background: #fff;
          cursor: pointer;
          transition: all 0.15s ease;
          font-size: 0;   /* hide inline font-size, use children */
        }

        .comorbid-level-btn .clb-icon { font-size: 0.85rem; line-height: 1; }
        .comorbid-level-btn .clb-label { font-size: 0.8rem; font-weight: 500; color: #374151; }

        .comorbid-level-btn:hover { border-color: #93c5fd; background: #eff6ff; }

        .comorbid-level-btn.active {
          border-color: #3b82f6;
          background: #3b82f6;
        }
        .comorbid-level-btn.active .clb-label { color: #fff; font-weight: 600; }

        @media (max-width: 480px) {
          .comorbid-full-name { white-space: normal; }
          .comorbid-level-row { gap: 0.375rem; }
          .comorbid-level-btn { padding: 0.3rem 0.55rem; }
        }
      `}</style>
    </div>
  );
}

export default RegisterPage;