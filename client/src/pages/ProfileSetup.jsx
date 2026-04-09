import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import axios from 'axios';
import StudentNavbar from '../components/StudentNavbar';

export default function ProfileSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [qualificationInfo, setQualificationInfo] = useState(null);

  const email = user?.email || user?.firebaseUser?.email || '';
  const [registeredName, setRegisteredName] = useState(user?.name || '');

  const [profile, setProfile] = useState({
    department: '',
    cgpa: '',
    projectCount: '',
    projectDomain: '',
    preferredDomain: '',
    interests: [],
    skills: []
  });

  // Available options from faculty
  const [availableSkills, setAvailableSkills] = useState([]);
  const [availableInterests, setAvailableInterests] = useState([]);
  const [availableDomains, setAvailableDomains] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  const normalizeCollection = (payload, key) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload[key])) return payload[key];
    return [];
  };

  const fetchAvailableData = async () => {
    try {
      const token = authService.getToken();
      if (!token) return;

      setDataLoading(true);

      const [skillsRes, interestsRes, domainsRes] = await Promise.allSettled([
        axios.get('http://localhost:5000/api/profile/skills', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/profile/interests', {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get('http://localhost:5000/api/profile/domains', {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (skillsRes.status === 'fulfilled') {
        setAvailableSkills(normalizeCollection(skillsRes.value.data, 'skills'));
      } else {
        setAvailableSkills([]);
        console.error('Failed to load skills:', skillsRes.reason?.response?.data || skillsRes.reason?.message);
      }

      if (interestsRes.status === 'fulfilled') {
        setAvailableInterests(normalizeCollection(interestsRes.value.data, 'interests'));
      } else {
        setAvailableInterests([]);
        console.error('Failed to load interests:', interestsRes.reason?.response?.data || interestsRes.reason?.message);
      }

      if (domainsRes.status === 'fulfilled') {
        setAvailableDomains(normalizeCollection(domainsRes.value.data, 'domains'));
      } else {
        setAvailableDomains([]);
        console.error('Failed to load domains:', domainsRes.reason?.response?.data || domainsRes.reason?.message);
      }
    } catch (err) {
      console.error('Failed to fetch available data:', err.response?.data || err.message);
    } finally {
      setDataLoading(false);
    }
  };

  // Toggle skill selection
  const toggleSkill = (skillId) => {
    setProfile((prev) => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter((id) => id !== skillId)
        : [...prev.skills, skillId]
    }));
  };

  // Toggle interest selection
  const toggleInterest = (interestId) => {
    setProfile((prev) => ({
      ...prev,
      interests: prev.interests.includes(interestId)
        ? prev.interests.filter((id) => id !== interestId)
        : [...prev.interests, interestId]
    }));
  };

  // Fetch available skills, interests, and domains from faculty
  useEffect(() => {
    fetchAvailableData();
  }, []);

  // Load existing profile
  useEffect(() => {
    const loadExistingProfile = async () => {
      try {
        const token = authService.getToken();
        if (!token) return;

        const res = await axios.get('http://localhost:5000/api/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });

        const existing = res.data || {};
        const existingProjectCount = Array.isArray(existing.projectsDone)
          ? existing.projectsDone.reduce((sum, p) => sum + (Number(p?.count) || 0), 0)
          : 0;
        const existingProjectDomain = Array.isArray(existing.projectsDone) && existing.projectsDone.length > 0
          ? (existing.projectsDone[0]?.domain || '')
          : '';

        setQualificationInfo({
          roleName: existing?.selectedRole?.trackName || existing?.selectedRole?.roleId?.roleName || '',
          finalAssessmentPassed: Boolean(existing?.selectedRole?.finalAssessmentPassed),
          qualifiedAt: existing?.selectedRole?.qualifiedAt || null,
          qualifiedRoles: Array.isArray(existing?.qualifiedRoles)
            ? existing.qualifiedRoles.map((entry) => ({
                roleName: entry?.trackName || entry?.roleName || 'Qualified Role',
                qualifiedAt: entry?.qualifiedAt || null,
              }))
            : [],
        });

        setRegisteredName(existing.name || user?.name || '');
        setProfile((prev) => ({
          ...prev,
          department: existing.department || '',
          cgpa: existing.cgpa ?? '',
          projectCount: existingProjectCount > 0 ? String(existingProjectCount) : '',
          projectDomain: existingProjectDomain,
          preferredDomain: existing.preferredDomain || '',
          skills: Array.isArray(existing.skills)
            ? existing.skills.map((s) => (typeof s === 'object' ? s._id : s)).filter(Boolean)
            : [],
          interests: Array.isArray(existing.interests)
            ? existing.interests.map((i) => (typeof i === 'object' ? i._id : i)).filter(Boolean)
            : [],
        }));
      } catch (err) {
        if (err.response?.status !== 404) {
          console.error('Profile load error:', err.response?.data || err.message);
        }
      }
    };

    loadExistingProfile();
  }, [user?.name]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const parsedProjectCount = Number(profile.projectCount);
      const hasProjectCount = Number.isFinite(parsedProjectCount) && parsedProjectCount > 0;

      if (hasProjectCount && !profile.projectDomain) {
        setError('Please select a project domain when project count is provided.');
        setLoading(false);
        return;
      }

      const payload = {
        name: registeredName || user?.name || '',
        department: profile.department,
        cgpa: parseFloat(profile.cgpa),
        preferredDomain: profile.preferredDomain,
        skills: profile.skills,
        interests: profile.interests,
        projectsDone: hasProjectCount
          ? [{ domain: profile.projectDomain, count: parsedProjectCount }]
          : []
      };

      const token = authService.getToken();
      await axios.post('http://localhost:5000/api/profile', payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuccessMessage('Profile saved successfully. You can now generate recommendations.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save profile');
      console.error('Profile save error:', err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateRecommendations = async () => {
    setRecommendLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      const token = authService.getToken();
      await axios.post('http://localhost:5000/api/recommend', {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate recommendations');
    } finally {
      setRecommendLoading(false);
    }
  };

  return (
    <div className="min-vh-100 bg-gradient-dark pb-5">
      <StudentNavbar />
      <div className="container pt-4" style={{ maxWidth: '900px' }}>
        <div className="glass-effect p-4 p-md-5 animate-fade-in-up">
          <div className="text-center mb-4">
            <h1 className="text-white fw-bold mb-2">Complete Your Profile</h1>
            <p className="text-white mb-0" style={{ opacity: 0.9 }}>
              Help LearnEx understand your background for better recommendations.
            </p>
            <button
              type="button"
              onClick={fetchAvailableData}
              className="btn btn-sm btn-outline-light mt-3"
              disabled={dataLoading}
            >
              {dataLoading ? 'Refreshing...' : 'Refresh Skills/Interests/Domains'}
            </button>
          </div>

          {error && (
            <div className="alert alert-danger border-0 rounded-4" role="alert">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="alert alert-success border-0 rounded-4" role="alert">
              {successMessage}
            </div>
          )}

          {qualificationInfo?.roleName && (
            <div className={`alert border-0 rounded-4 ${qualificationInfo.finalAssessmentPassed ? 'alert-success' : 'alert-warning'}`} role="alert">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2">
                <div>
                  <strong>Selected Role:</strong> {qualificationInfo.roleName}
                  <div className="small mt-1">
                    {qualificationInfo.finalAssessmentPassed
                      ? 'Qualified Role: Final assessment passed.'
                      : 'Not Qualified Yet: Complete and pass final assessment to be marked qualified.'}
                  </div>
                </div>
                <span className={`badge ${qualificationInfo.finalAssessmentPassed ? 'text-bg-success' : 'text-bg-warning'}`}>
                  {qualificationInfo.finalAssessmentPassed ? 'Qualified Role' : 'Not Qualified Yet'}
                </span>
              </div>
              {qualificationInfo.finalAssessmentPassed && qualificationInfo.qualifiedAt && (
                <small className="d-block mt-2">Qualified on: {new Date(qualificationInfo.qualifiedAt).toLocaleString()}</small>
              )}
              {qualificationInfo.finalAssessmentPassed && qualificationInfo.qualifiedRoles?.length > 0 && (
                <div className="mt-2 small">
                  <strong>Qualified Roles:</strong>{' '}
                  {qualificationInfo.qualifiedRoles.map((entry) => entry.roleName).join(', ')}
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label text-white">Full Name</label>
                <input
                  required
                  type="text"
                  value={registeredName || user?.name || ''}
                  readOnly
                  className="form-control"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label text-white">Email</label>
                <input
                  required
                  type="email"
                  value={email}
                  readOnly
                  className="form-control"
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-white">Department</label>
                <input
                  required
                  type="text"
                  value={profile.department}
                  onChange={(e) => setProfile({ ...profile, department: e.target.value })}
                  className="form-control"
                  placeholder="e.g. Computer Science"
                />
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label text-white">CGPA</label>
                <input
                  required
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  value={profile.cgpa}
                  onChange={(e) => setProfile({ ...profile, cgpa: e.target.value })}
                  className="form-control"
                  placeholder="e.g. 8.5"
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-white">Projects Completed (Optional)</label>
                <input
                  type="number"
                  min="0"
                  value={profile.projectCount}
                  onChange={(e) => setProfile({ ...profile, projectCount: e.target.value })}
                  className="form-control"
                  placeholder="e.g. 3"
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="form-label text-white">Project Domain {Number(profile.projectCount) > 0 ? '*' : '(Optional)'}</label>
                {dataLoading ? (
                  <div className="text-white" style={{ opacity: 0.9 }}>Loading available domains...</div>
                ) : availableDomains.length === 0 ? (
                  <div className="alert alert-warning mb-0">
                    No domains available yet. Please contact your faculty coordinator to add domains first.
                  </div>
                ) : (
                  <select
                    value={profile.projectDomain}
                    onChange={(e) => setProfile({ ...profile, projectDomain: e.target.value })}
                    className="form-select"
                    required={Number(profile.projectCount) > 0}
                  >
                    <option value="">Select project domain</option>
                    {availableDomains.map((domain) => (
                      <option key={`project-domain-${domain._id}`} value={domain.name}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-12">
                <label className="form-label text-white">Preferred Domain</label>
                {dataLoading ? (
                  <div className="text-white" style={{ opacity: 0.9 }}>Loading available domains...</div>
                ) : availableDomains.length === 0 ? (
                  <div className="alert alert-warning mb-0">
                    No domains available yet. Please contact your faculty coordinator to add domains first.
                  </div>
                ) : (
                  <select
                    required
                    value={profile.preferredDomain}
                    onChange={(e) => setProfile({ ...profile, preferredDomain: e.target.value })}
                    className="form-select"
                  >
                    <option value="">Select your preferred domain</option>
                    {availableDomains.map((domain) => (
                      <option key={domain._id} value={domain.name}>
                        {domain.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="col-12">
                <label className="form-label text-white">Skills</label>
                {dataLoading ? (
                  <div className="text-white" style={{ opacity: 0.9 }}>Loading available skills...</div>
                ) : availableSkills.length === 0 ? (
                  <div className="alert alert-warning mb-0">
                    No skills available yet. Please contact your faculty coordinator to add skills first.
                  </div>
                ) : (
                  <div className="row g-2">
                    {availableSkills.map((skill) => (
                      <div key={skill._id} className="col-12 col-md-6 col-lg-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`skill-${skill._id}`}
                            checked={profile.skills.includes(skill._id)}
                            onChange={() => toggleSkill(skill._id)}
                          />
                          <label className="form-check-label text-white" htmlFor={`skill-${skill._id}`}>
                            {skill.name}
                            {skill.category && <small className="text-white ms-1" style={{ opacity: 0.7 }}>({skill.category})</small>}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-12">
                <label className="form-label text-white">Interests</label>
                {dataLoading ? (
                  <div className="text-white" style={{ opacity: 0.9 }}>Loading available interests...</div>
                ) : availableInterests.length === 0 ? (
                  <div className="alert alert-warning mb-0">
                    No interests available yet. Please contact your faculty coordinator to add interests first.
                  </div>
                ) : (
                  <div className="row g-2">
                    {availableInterests.map((interest) => (
                      <div key={interest._id} className="col-12 col-md-6 col-lg-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`interest-${interest._id}`}
                            checked={profile.interests.includes(interest._id)}
                            onChange={() => toggleInterest(interest._id)}
                          />
                          <label className="form-check-label text-white" htmlFor={`interest-${interest._id}`}>
                            {interest.name}
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="col-12 mt-3">
                <div className="d-flex flex-column flex-md-row gap-2">
                  <button type="submit" disabled={loading || recommendLoading} className="btn btn-outline-light flex-fill py-2">
                    {loading ? 'Saving Profile...' : 'Save Profile'}
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateRecommendations}
                    disabled={loading || recommendLoading}
                    className="btn btn-gradient flex-fill py-2"
                  >
                    {recommendLoading ? 'Generating Recommendations...' : 'Get Recommendations'}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

