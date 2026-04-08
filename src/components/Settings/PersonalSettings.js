import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase-config';
import { doc, updateDoc, getDoc, deleteDoc, collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider, deleteUser } from 'firebase/auth';
import { useAuth } from '../../AuthContext';
import "../Common.css";
import "./PersonalSettings.css";

import {
  ArrowLeft, Save, User, Mail, Lock, Calendar, Scale, Ruler,
  Check, Eye, EyeOff, LogOut, Trash2, AlertTriangle,
} from 'lucide-react';

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
  { value: 'mild',        label: 'Mild',        icon: '🟡' },
  { value: 'moderate',    label: 'Moderate',    icon: '🟠' },
  { value: 'severe',      label: 'Severe',      icon: '🔴' },
  { value: 'very-severe', label: 'Very Severe', icon: '🟣' },
];
// ───────────────────────────────────────────────────────────────────────────

// Conversion utilities
const convertWeight = {
  lbsToKg: (lbs) => lbs * 0.453592,
  kgToLbs: (kg)  => kg  * 2.20462,
};

const convertHeight = {
  feetInchesToCm: (feet, inches) => (feet * 12 + inches) * 2.54,
  cmToFeetInches: (cm) => {
    const totalInches = cm / 2.54;
    const feet   = Math.floor(totalInches / 12);
    const inches = Math.round(totalInches % 12);
    return { feet, inches };
  },
};

const PersonalSettings = () => {
  const navigate = useNavigate();
  const { user, signOut, refreshProfile } = useAuth();

  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [userData, setUserData] = useState(null);

  const [showPasswordSection,           setShowPasswordSection]           = useState(false);
  const [showCurrentPassword,           setShowCurrentPassword]           = useState(false);
  const [showNewPassword,               setShowNewPassword]               = useState(false);
  const [showConfirmPassword,           setShowConfirmPassword]           = useState(false);
  const [showDeleteConfirmation,        setShowDeleteConfirmation]        = useState(false);
  const [showDeletePasswordConfirmation,setShowDeletePasswordConfirmation]= useState(false);
  const [showDeletePassword,            setShowDeletePassword]            = useState(false);
  const [deletePassword,                setDeletePassword]                = useState('');

  const [formData, setFormData] = useState({
    name: '',
    email: '',
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

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [errors,         setErrors]         = useState({});
  const [successMessage, setSuccessMessage] = useState('');

  // Floating label functionality
  useEffect(() => {
    const inputs = document.querySelectorAll('input, select, textarea');

    const handleFloatingLabels = (input) => {
      const formGroup = input.closest('.form-group');
      const label     = formGroup?.querySelector('.form-label');

      if (!label || !formGroup) {
        return { handleFocus: () => {}, handleBlur: () => {}, handleInput: () => {}, updateLabelState: () => {} };
      }

      const updateLabelState = () => {
        const hasValue  = input.value && input.value.length > 0;
        const isFocused = document.activeElement === input;
        if (hasValue || isFocused) { label.classList.add('floating');    formGroup.classList.add('has-content'); }
        else                       { label.classList.remove('floating'); formGroup.classList.remove('has-content'); }
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
          input.addEventListener('blur',  handlers.handleBlur);
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
            input.removeEventListener('blur',  handlers.handleBlur);
            input.removeEventListener('input', handlers.handleInput);
          }
        } catch (error) { console.warn('Error cleaning up input handlers:', error); }
      });
    };
  }, []);

  useEffect(() => {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      try {
        const formGroup = input.closest('.form-group');
        const label     = formGroup?.querySelector('.form-label');
        if (label && formGroup) {
          const hasValue = input.value && input.value.length > 0;
          if (hasValue) { label.classList.add('floating');    formGroup.classList.add('has-content'); }
          else          { label.classList.remove('floating'); formGroup.classList.remove('has-content'); }
        }
      } catch (error) { console.warn('Error updating floating labels:', error); }
    });
  }, [formData]);

  // Load user data — uid comes from AuthContext, no localStorage needed
  const loadUserData = useCallback(async (uid) => {
    try {
      const userDocRef  = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef, { source: 'server' });

      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        setUserData({ id: uid, ...data });

        const userUnitSystem = data.unitSystem || 'metric';
        let displayWeight       = data.weight  || '';
        let displayHeight       = data.height  || '';
        let displayHeightFeet   = '';
        let displayHeightInches = '';

        if (userUnitSystem === 'imperial') {
          if (data.weight) displayWeight = Math.round(convertWeight.kgToLbs(data.weight) * 10) / 10;
          if (data.height) {
            const { feet, inches } = convertHeight.cmToFeetInches(data.height);
            displayHeightFeet   = feet;
            displayHeightInches = inches;
            displayHeight       = '';
          }
        }

        setFormData({
          name:               data.name              || '',
          email:              data.email             || '',
          age:                data.age               || '',
          gender:             data.gender            || '',
          unitSystem:         userUnitSystem,
          weight:             displayWeight,
          height:             displayHeight,
          heightFeet:         displayHeightFeet,
          heightInches:       displayHeightInches,
          covidDate:          data.covidDate         || '',
          covidDuration:      data.covidDuration     || '',
          severity:           data.severity          || '',
          symptoms:           data.symptoms          || [],
          comorbidConditions: data.comorbidConditions || {},
          medicalConditions:  data.medicalConditions  || '',
        });
      } else {
        console.error('User document not found');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      navigate('/login');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  // Trigger load when Firebase Auth user is available
  useEffect(() => {
    if (user) {
      loadUserData(user.uid);
    } else if (user === null) {
      // Explicitly null (not undefined) means auth resolved with no session
      navigate('/login', { replace: true });
      setLoading(false);
    }
  }, [user, loadUserData, navigate]);

  const handleLogout = async () => {
    try {
      await signOut(); // from AuthContext — onAuthStateChanged handles redirect
    } catch (error) {
      console.error('Error during logout:', error);
      navigate('/login', { replace: true });
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletePassword.trim()) {
      setErrors({ deletePassword: 'Password is required for account deletion' });
      return;
    }

    setDeleting(true);
    setErrors({});

    try {
      if (!user) throw new Error('No authenticated user found');
      const credential = EmailAuthProvider.credential(user.email, deletePassword);
      await reauthenticateWithCredential(user, credential);

      const userId = user.uid; // use Firebase Auth uid directly
      await deleteDoc(doc(db, 'users', userId));

      const foodLogsQuery    = query(collection(db, 'foodLogs'), where('userId', '==', userId));
      const foodLogsSnapshot = await getDocs(foodLogsQuery);
      const batch            = writeBatch(db);
      foodLogsSnapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();

      await deleteUser(user);
      // onAuthStateChanged fires with null → redirects to /login automatically

    } catch (error) {
      console.error('Error deleting account:', error);
      if      (error.code === 'auth/wrong-password')    setErrors({ deletePassword: 'Incorrect password' });
      else if (error.code === 'auth/too-many-requests') setErrors({ deletePassword: 'Too many failed attempts. Please try again later.' });
      else                                              setErrors({ deletePassword: 'Failed to delete account. Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

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
    setSuccessMessage('');
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  // ── Comorbid condition handlers ────────────────────────────────────────
  const handleConditionToggle = (conditionId) => {
    setFormData(prev => {
      const current = prev.comorbidConditions ?? {};
      const updated = { ...current };
      if (conditionId in updated) {
        delete updated[conditionId];   // deselect — remove key entirely
      } else {
        updated[conditionId] = 'moderate';  // select with default severity
      }
      return { ...prev, comorbidConditions: updated };
    });
    setSuccessMessage('');
  };

  const handleConditionLevel = (conditionId, level) => {
    setFormData(prev => ({
      ...prev,
      comorbidConditions: { ...prev.comorbidConditions, [conditionId]: level },
    }));
    setSuccessMessage('');
  };
  // ──────────────────────────────────────────────────────────────────────

  const handleUnitSystemChange = (e) => {
    const newSystem = e.target.value;
    const oldSystem = formData.unitSystem;
    let updatedData = { unitSystem: newSystem };

    if (formData.weight) {
      if      (oldSystem === 'metric'   && newSystem === 'imperial') updatedData.weight = Math.round(convertWeight.kgToLbs(parseFloat(formData.weight)) * 10) / 10;
      else if (oldSystem === 'imperial' && newSystem === 'metric')   updatedData.weight = Math.round(convertWeight.lbsToKg(parseFloat(formData.weight)) * 10) / 10;
    }

    if (newSystem === 'imperial' && formData.height) {
      const { feet, inches } = convertHeight.cmToFeetInches(parseFloat(formData.height));
      updatedData.heightFeet   = feet;
      updatedData.heightInches = inches;
      updatedData.height       = '';
    } else if (newSystem === 'metric' && (formData.heightFeet || formData.heightInches)) {
      updatedData.height       = Math.round(convertHeight.feetInchesToCm(parseFloat(formData.heightFeet) || 0, parseFloat(formData.heightInches) || 0));
      updatedData.heightFeet   = '';
      updatedData.heightInches = '';
    }

    setFormData(prev => ({ ...prev, ...updatedData }));
    setSuccessMessage('');
  };

  const handleSaveChanges = async () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.age)         newErrors.age  = 'Age is required';
    else if (formData.age < 13) newErrors.age = 'Age must be at least 13';
    if (!formData.gender)      newErrors.gender = 'Gender is required';

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    setErrors({});

    try {
      let weightInKg = formData.weight ? parseFloat(formData.weight) : null;
      let heightInCm = formData.height ? parseFloat(formData.height) : null;

      if (formData.unitSystem === 'imperial') {
        if (weightInKg) weightInKg = convertWeight.lbsToKg(weightInKg);
        if (formData.heightFeet || formData.heightInches) {
          heightInCm = convertHeight.feetInchesToCm(parseFloat(formData.heightFeet) || 0, parseFloat(formData.heightInches) || 0);
        }
      }

      const updatedData = {
        name:               formData.name,
        age:                parseInt(formData.age),
        gender:             formData.gender,
        unitSystem:         formData.unitSystem,
        weight:             weightInKg ? Math.round(weightInKg * 10) / 10 : null,
        height:             heightInCm ? Math.round(heightInCm)           : null,
        covidDate:          formData.covidDate          || null,
        covidDuration:      formData.covidDuration      || null,
        severity:           formData.severity           || null,
        symptoms:           formData.symptoms,
        comorbidConditions: formData.comorbidConditions,   // ← persist
        medicalConditions:  formData.medicalConditions  || null,
        updatedAt:          new Date().toISOString(),
      };

      const uid = user?.uid;
      if (!uid) throw new Error('No authenticated user');

      await updateDoc(doc(db, 'users', uid), updatedData);

      // Re-read from server to confirm what was saved
      const confirmedSnap = await getDoc(doc(db, 'users', uid), { source: 'server' });
      const confirmedData = confirmedSnap.exists() ? confirmedSnap.data() : updatedData;

      setUserData({ id: uid, ...confirmedData });
      await refreshProfile(); // update AuthContext so all pages see new profile

      // Sync formData to exactly what Firestore has
      setFormData(prev => ({
        ...prev,
        comorbidConditions: confirmedData.comorbidConditions ?? {},
        severity:           confirmedData.severity           ?? '',
        symptoms:           confirmedData.symptoms           ?? [],
      }));

      setSuccessMessage('Profile updated successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('Error updating profile:', error);
      setErrors({ submit: 'Failed to update profile. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const newErrors = {};
    if (!passwordData.currentPassword)                             newErrors.currentPassword = 'Current password is required';
    if (!passwordData.newPassword)                                 newErrors.newPassword     = 'New password is required';
    else if (passwordData.newPassword.length < 6)                  newErrors.newPassword     = 'Password must be at least 6 characters';
    if (passwordData.newPassword !== passwordData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';

    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    setErrors({});

    try {
      if (!user) throw new Error('No authenticated user found');
      const credential = EmailAuthProvider.credential(user.email, passwordData.currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, passwordData.newPassword);

      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setShowPasswordSection(false);
      setSuccessMessage('Password changed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);

    } catch (error) {
      console.error('Error changing password:', error);
      if (error.code === 'auth/wrong-password') setErrors({ currentPassword: 'Current password is incorrect' });
      else setErrors({ submit: 'Failed to change password. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="personal-settings-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="personal-settings-page">
      <div className="settings-container">
        <div className="settings-header">
          <button onClick={() => navigate('/')} className="back-button">
            <ArrowLeft className="back-icon" />
            Back to Dashboard
          </button>
          <h1 className="settings-title">Personal Settings</h1>
          <p className="settings-subtitle">Manage your account and preferences</p>
        </div>

        {successMessage && (
          <div className="success-message-banner">
            <Check className="success-icon" />
            {successMessage}
          </div>
        )}

        {/* ── Profile Information ── */}
        <div className="settings-card">
          <div className="card-header">
            <h2 className="card-title">Profile Information</h2>
            <p className="card-subtitle">Update your personal details</p>
          </div>

          <div className="form-sections">
            <div className="form-group">
              <User className="form-label-icon" />
              <input type="text" name="name" value={formData.name} onChange={handleInputChange}
                className={`form-input ${errors.name ? 'error' : ''}`} placeholder="Your full name" />
              <label className="form-label">Full Name *</label>
              {errors.name && <p className="error-message">{errors.name}</p>}
            </div>

            <div className="form-group">
              <Mail className="form-label-icon" />
              <input type="email" value={formData.email} className="form-input" placeholder="your@email.com" disabled />
              <label className="form-label">Email Address</label>
              <p className="field-note">Email cannot be changed</p>
            </div>

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
          </div>
        </div>

        {/* ── Health Information ── */}
        <div className="settings-card">
          <div className="card-header">
            <h2 className="card-title">Health Information</h2>
            <p className="card-subtitle">Update your COVID and health details</p>
          </div>

          <div className="form-sections">
            <div className="form-section-divider">Condition History</div>
            <div className="form-row form-row-2">
              <div className="form-group">
                <Calendar className="form-label-icon" />
                <input type="date" name="covidDate" value={formData.covidDate} onChange={handleInputChange} className="form-input" />
                <label className="form-label">First COVID Date</label>
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

            <div className="form-group">
              <select name="severity" value={formData.severity} onChange={handleInputChange} className="form-select">
                <option value="">Select severity</option>
                <option value="mild">Mild</option>
                <option value="moderate">Moderate</option>
                <option value="severe">Severe</option>
                <option value="very-severe">Very Severe</option>
              </select>
              <label className="form-label">COVID Severity</label>
            </div>

            {/* ── Comorbid conditions ── */}
            <div className="form-section-divider">
              Related Conditions <span>(select all that apply — or none)</span>
            </div>
            <div className="comorbid-conditions-section">
              {COMORBID_CONDITIONS.map(condition => {
                const isSelected   = condition.id in formData.comorbidConditions;
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

            {/* ── Symptoms ── */}
            <div className="form-section-divider">Symptoms</div>
            <div className="symptoms-section">
              <label className="form-label">Current Symptoms (Select all that apply)</label>
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
                className="form-textarea" placeholder="List any pre-existing medical conditions..." rows="4" />
              <label className="form-label">Pre-existing Medical Conditions</label>
            </div>

            {errors.submit && <p className="error-message text-center">{errors.submit}</p>}
          </div>

          <div className="card-actions">
            <button onClick={handleSaveChanges} className="btn btn-primary" disabled={saving}>
              {saving ? (
                <><div className="loading-spinner"></div>Saving...</>
              ) : (
                <><Save className="btn-icon" />Save Changes</>
              )}
            </button>
          </div>
        </div>

        {/* ── Password ── */}
        <div className="settings-card">
          <div className="card-header">
            <h2 className="card-title">Security</h2>
            <p className="card-subtitle">Manage your password</p>
          </div>

          {!showPasswordSection ? (
            <button onClick={() => setShowPasswordSection(true)} className="btn btn-secondary">
              <Lock className="btn-icon" />
              Change Password
            </button>
          ) : (
            <div className="password-section">
              <div className="form-sections">
                <div className="form-group" style={{ position: 'relative' }}>
                  <Lock className="form-label-icon" />
                  <input type={showCurrentPassword ? 'text' : 'password'} name="currentPassword"
                    value={passwordData.currentPassword} onChange={handlePasswordChange}
                    className={`form-input ${errors.currentPassword ? 'error' : ''}`} placeholder="Current password" />
                  <label className="form-label">Current Password</label>
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="password-toggle">
                    {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {errors.currentPassword && <p className="error-message">{errors.currentPassword}</p>}
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <Lock className="form-label-icon" />
                  <input type={showNewPassword ? 'text' : 'password'} name="newPassword"
                    value={passwordData.newPassword} onChange={handlePasswordChange}
                    className={`form-input ${errors.newPassword ? 'error' : ''}`} placeholder="Enter new password" />
                  <label className="form-label">New Password</label>
                  <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="password-toggle">
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {errors.newPassword && <p className="error-message">{errors.newPassword}</p>}
                </div>

                <div className="form-group" style={{ position: 'relative' }}>
                  <Lock className="form-label-icon" />
                  <input type={showConfirmPassword ? 'text' : 'password'} name="confirmPassword"
                    value={passwordData.confirmPassword} onChange={handlePasswordChange}
                    className={`form-input ${errors.confirmPassword ? 'error' : ''}`} placeholder="Confirm new password" />
                  <label className="form-label">Confirm New Password</label>
                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="password-toggle">
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                  {errors.confirmPassword && <p className="error-message">{errors.confirmPassword}</p>}
                </div>
              </div>

              <div className="card-actions">
                <button
                  onClick={() => {
                    setShowPasswordSection(false);
                    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                    setErrors({});
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleChangePassword} className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <><div className="loading-spinner"></div>Updating...</>
                  ) : (
                    <><Check className="btn-icon" />Update Password</>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Account Actions ── */}
        <div className="settings-card danger-zone">
          <div className="card-header">
            <h2 className="card-title">Account Actions</h2>
            <p className="card-subtitle">Logout or permanently delete your account</p>
          </div>

          <div className="header-actions">
            <button onClick={handleLogout} className="btn btn-secondary">
              <LogOut className="btn-icon" />
              Logout
            </button>

            {!showDeleteConfirmation ? (
              <button onClick={() => setShowDeleteConfirmation(true)} className="btn btn-danger">
                <Trash2 className="btn-icon" />
                Delete Account
              </button>
            ) : (
              <div className="danger-confirmation">
                <h3 className="danger-confirmation-title">
                  <AlertTriangle className="btn-icon" />
                  Delete Account
                </h3>
                <p className="danger-confirmation-text">
                  This action cannot be undone. All your data, including food logs and personal information, will be permanently deleted.
                </p>

                {!showDeletePasswordConfirmation ? (
                  <div className="danger-actions">
                    <button onClick={() => setShowDeleteConfirmation(false)} className="btn btn-secondary">Cancel</button>
                    <button onClick={() => setShowDeletePasswordConfirmation(true)} className="btn btn-danger">
                      I Understand, Delete My Account
                    </button>
                  </div>
                ) : (
                  <div className="delete-password-section">
                    <div className="form-group">
                      <Lock className="form-label-icon" />
                      <input type={showDeletePassword ? 'text' : 'password'} value={deletePassword}
                        onChange={(e) => {
                          setDeletePassword(e.target.value);
                          if (errors.deletePassword) setErrors(prev => ({ ...prev, deletePassword: '' }));
                        }}
                        className={`form-input ${errors.deletePassword ? 'error' : ''}`}
                        placeholder="Enter your password to confirm" />
                      <label className="form-label">Confirm Password</label>
                      <button type="button" onClick={() => setShowDeletePassword(!showDeletePassword)} className="password-toggle">
                        {showDeletePassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      {errors.deletePassword && <p className="error-message">{errors.deletePassword}</p>}
                    </div>

                    <div className="danger-actions">
                      <button
                        onClick={() => { setShowDeletePasswordConfirmation(false); setDeletePassword(''); setErrors({}); }}
                        className="btn btn-secondary"
                      >
                        Cancel
                      </button>
                      <button onClick={handleDeleteAccount} className="btn btn-danger" disabled={deleting}>
                        {deleting ? (
                          <><div className="loading-spinner"></div>Deleting...</>
                        ) : (
                          <><Trash2 className="btn-icon" />Permanently Delete Account</>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
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

        .comorbid-body {
          padding: 0.75rem 1rem 1rem;
          border-top: 1px solid #dbeafe;
          background: #f8fbff;
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
        }

        .comorbid-level-btn .clb-icon  { font-size: 0.85rem; line-height: 1; }
        .comorbid-level-btn .clb-label { font-size: 0.8rem; font-weight: 500; color: #374151; }

        .comorbid-level-btn:hover { border-color: #93c5fd; background: #eff6ff; }

        .comorbid-level-btn.active {
          border-color: #3b82f6;
          background: #3b82f6;
        }
        .comorbid-level-btn.active .clb-label { color: #fff; font-weight: 600; }

        /* Height inputs */
        .height-imperial-group { position: relative; }
        .height-imperial-inputs { display: flex; align-items: center; gap: 0.5rem; }
        .height-imperial-inputs .form-input { flex: 1; min-width: 0; }
        .height-separator { color: var(--gray-600); font-size: 0.875rem; font-weight: 500; }
        .height-feet   { flex: 1.2 !important; }
        .height-inches { flex: 0.8 !important; }
        .field-note { font-size: 0.75rem; color: var(--gray-500); margin-top: 0.25rem; font-style: italic; }

        /* Password toggle */
        .form-group:has(.password-toggle) .form-input { padding-right: 3rem; }

        @media (max-width: 480px) {
          .comorbid-full-name { white-space: normal; }
          .comorbid-level-row { gap: 0.375rem; }
          .comorbid-level-btn { padding: 0.3rem 0.55rem; }
        }
      `}</style>
    </div>
  );
};

export default PersonalSettings;