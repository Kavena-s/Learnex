import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';
import useAutoRefresh from '../../hooks/useAutoRefresh';

export default function FacultyDatasets() {
  useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'skills';

  const [skills, setSkills] = useState([]);
  const [interests, setInterests] = useState([]);
  const [domains, setDomains] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showSkillForm, setShowSkillForm] = useState(false);
  const [showInterestForm, setShowInterestForm] = useState(false);
  const [showDomainForm, setShowDomainForm] = useState(false);
  const [showRoleForm, setShowRoleForm] = useState(false);

  const [skillForm, setSkillForm] = useState({ name: '', category: '' });
  const [interestForm, setInterestForm] = useState({ name: '' });
  const [domainForm, setDomainForm] = useState({ name: '' });
  const initialRoleForm = { 
    roleName: '', 
    domain: '',
    description: '', 
    minCGPA: 0, 
    minProjects: 0, 
    requiredSkills: [], 
    relatedInterests: [],
    roadmap: {
      beginner: { topics: [], description: '', estimatedHours: 0 },
      intermediate: { topics: [], description: '', estimatedHours: 0 },
      advanced: { topics: [], description: '', estimatedHours: 0 }
    }
  };

  const [roleForm, setRoleForm] = useState(initialRoleForm);
  const [editingRoleId, setEditingRoleId] = useState(null);

  const fetchData = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const token = authService.getToken();
      const headers = { Authorization: `Bearer ${token}` };
      if (activeTab === 'skills') {
        const skillsRes = await axios.get('http://localhost:5000/api/faculty/skills', { headers });
        setSkills(Array.isArray(skillsRes.data) ? skillsRes.data : (skillsRes.data?.skills || []));
      }
      if (activeTab === 'interests') {
        const interestsRes = await axios.get('http://localhost:5000/api/faculty/interests', { headers });
        setInterests(Array.isArray(interestsRes.data) ? interestsRes.data : (interestsRes.data?.interests || []));
      }
      if (activeTab === 'domains') {
        const domainsRes = await axios.get('http://localhost:5000/api/faculty/domains', { headers });
        setDomains(Array.isArray(domainsRes.data) ? domainsRes.data : (domainsRes.data?.domains || []));
      }
      if (activeTab === 'roles') {
        // Load supporting datasets for the role form
        const [rolesRes, skillsRes, interestsRes, domainsRes] = await Promise.all([
          axios.get('http://localhost:5000/api/faculty/roles', { headers }),
          axios.get('http://localhost:5000/api/faculty/skills', { headers }),
          axios.get('http://localhost:5000/api/faculty/interests', { headers }),
          axios.get('http://localhost:5000/api/faculty/domains', { headers }),
        ]);
        setRoles(Array.isArray(rolesRes.data) ? rolesRes.data : (rolesRes.data?.roles || []));
        setSkills(Array.isArray(skillsRes.data) ? skillsRes.data : (skillsRes.data?.skills || []));
        setInterests(Array.isArray(interestsRes.data) ? interestsRes.data : (interestsRes.data?.interests || []));
        setDomains(Array.isArray(domainsRes.data) ? domainsRes.data : (domainsRes.data?.domains || []));
      }
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeTab]);
  useAutoRefresh(fetchData, { intervalMs: 30000 });

  const tokenHeaders = async () => ({ Authorization: `Bearer ${authService.getToken()}` });

  const handleCreateSkill = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/faculty/skills', skillForm, { headers: await tokenHeaders() });
      setSkillForm({ name: '', category: '' }); setShowSkillForm(false); fetchData();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create skill'); }
  };

  const handleDeleteSkill = async (id) => {
    if (!confirm('Delete this skill?')) return;
    try { await axios.delete(`http://localhost:5000/api/faculty/skills/${id}`, { headers: await tokenHeaders() }); fetchData(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to delete skill'); }
  };

  const handleCreateInterest = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/faculty/interests', interestForm, { headers: await tokenHeaders() });
      setInterestForm({ name: '' }); setShowInterestForm(false); fetchData();
    } catch (err) { alert(err.response?.data?.message || 'Failed to create interest'); }
  };

  const handleDeleteInterest = async (id) => {
    if (!confirm('Delete this interest?')) return;
    try { await axios.delete(`http://localhost:5000/api/faculty/interests/${id}`, { headers: await tokenHeaders() }); fetchData(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to delete interest'); }
  };

  const handleCreateDomain = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:5000/api/faculty/domains', domainForm, { headers: await tokenHeaders() });
      setDomainForm({ name: '' });
      setShowDomainForm(false);
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create domain');
    }
  };

  const handleDeleteDomain = async (id) => {
    if (!confirm('Delete this domain?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/faculty/domains/${id}`, { headers: await tokenHeaders() });
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete domain');
    }
  };

  const resetRoleForm = () => {
    setRoleForm(initialRoleForm);
    setEditingRoleId(null);
  };

  const handleEditRole = (role) => {
    setEditingRoleId(role._id);
    setRoleForm({
      roleName: role.roleName || '',
      domain: role.domain || '',
      description: role.description || '',
      minCGPA: role.minCGPA ?? 0,
      minProjects: role.minProjects ?? 0,
      requiredSkills: Array.isArray(role.requiredSkills)
        ? role.requiredSkills.map((s) => (typeof s === 'object' ? s._id : s)).filter(Boolean)
        : [],
      relatedInterests: Array.isArray(role.relatedInterests)
        ? role.relatedInterests.map((i) => (typeof i === 'object' ? i._id : i)).filter(Boolean)
        : [],
      roadmap: {
        beginner: {
          topics: role.roadmap?.beginner?.topics || [],
          description: role.roadmap?.beginner?.description || '',
          estimatedHours: role.roadmap?.beginner?.estimatedHours || 0,
        },
        intermediate: {
          topics: role.roadmap?.intermediate?.topics || [],
          description: role.roadmap?.intermediate?.description || '',
          estimatedHours: role.roadmap?.intermediate?.estimatedHours || 0,
        },
        advanced: {
          topics: role.roadmap?.advanced?.topics || [],
          description: role.roadmap?.advanced?.description || '',
          estimatedHours: role.roadmap?.advanced?.estimatedHours || 0,
        },
      },
    });
    setShowRoleForm(true);
  };

  const handleSubmitRole = async (e) => {
    e.preventDefault();
    
    // Validate roadmap
    if (!roleForm.roadmap.beginner.topics.length || 
        !roleForm.roadmap.intermediate.topics.length || 
        !roleForm.roadmap.advanced.topics.length) {
      alert('Please add topics for all three learning levels (beginner, intermediate, advanced)');
      return;
    }
    
    try {
      if (editingRoleId) {
        await axios.put(`http://localhost:5000/api/faculty/roles/${editingRoleId}`, roleForm, { headers: await tokenHeaders() });
      } else {
        await axios.post('http://localhost:5000/api/faculty/roles', roleForm, { headers: await tokenHeaders() });
      }
      resetRoleForm();
      setShowRoleForm(false); 
      fetchData();
    } catch (err) { 
      alert(err.response?.data?.message || 'Failed to save role'); 
    }
  };

  const handleDeleteRole = async (id) => {
    if (!confirm('Delete this career path?')) return;
    try { await axios.delete(`http://localhost:5000/api/faculty/roles/${id}`, { headers: await tokenHeaders() }); fetchData(); }
    catch (err) { alert(err.response?.data?.message || 'Failed to delete role'); }
  };

  return (
    <FacultyLayout>
      <h2 className="text-white fw-bold mb-3">Dataset Management</h2>

      <ul className="nav nav-pills mb-3">
        {['skills', 'interests', 'domains', 'roles'].map((tab) => (
          <li className="nav-item" key={tab}>
            <button className={`nav-link ${activeTab === tab ? 'active' : ''}`} onClick={() => setSearchParams({ tab })}>
              {tab === 'roles' ? 'Career Paths' : tab[0].toUpperCase() + tab.slice(1)}
            </button>
          </li>
        ))}
      </ul>

      {activeTab === 'skills' && (
        <div className="card-modern p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Skills</h5>
            <button className="btn btn-sm btn-gradient" onClick={() => setShowSkillForm(!showSkillForm)}>{showSkillForm ? 'Cancel' : 'Add Skill'}</button>
          </div>
          {showSkillForm && (
            <form className="row g-2 mb-3" onSubmit={handleCreateSkill}>
              <div className="col-md-5">
                <input 
                  className="form-control" 
                  value={skillForm.name} 
                  onChange={(e)=>setSkillForm({...skillForm,name:e.target.value})} 
                  placeholder="Skill name (e.g., React)" 
                  required 
                />
              </div>
              <div className="col-md-5">
                <input 
                  className="form-control" 
                  value={skillForm.category} 
                  onChange={(e)=>setSkillForm({...skillForm,category:e.target.value})} 
                  placeholder="Category (e.g., Frontend)" 
                  required 
                />
              </div>
              <div className="col-md-2"><button className="btn btn-primary w-100">Create</button></div>
            </form>
          )}
          {loading ? <div className="spinner-gradient mx-auto"></div> : (
            <div className="list-group">
              {skills.map((s) => <div key={s._id} className="list-group-item d-flex justify-content-between"><span>{s.name}</span><button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteSkill(s._id)}>Delete</button></div>)}
              {!skills.length && <div className="text-muted">No skills found</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'interests' && (
        <div className="card-modern p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Interests</h5>
            <button className="btn btn-sm btn-gradient" onClick={() => setShowInterestForm(!showInterestForm)}>{showInterestForm ? 'Cancel' : 'Add Interest'}</button>
          </div>
          {showInterestForm && (
            <form className="row g-2 mb-3" onSubmit={handleCreateInterest}>
              <div className="col-md-10"><input className="form-control" value={interestForm.name} onChange={(e)=>setInterestForm({name:e.target.value})} placeholder="Interest name" required /></div>
              <div className="col-md-2"><button className="btn btn-primary w-100">Create</button></div>
            </form>
          )}
          {loading ? <div className="spinner-gradient mx-auto"></div> : (
            <div className="list-group">
              {interests.map((i) => <div key={i._id} className="list-group-item d-flex justify-content-between"><span>{i.name}</span><button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteInterest(i._id)}>Delete</button></div>)}
              {!interests.length && <div className="text-muted">No interests found</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'domains' && (
        <div className="card-modern p-3 mb-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Domains</h5>
            <button className="btn btn-sm btn-gradient" onClick={() => setShowDomainForm(!showDomainForm)}>
              {showDomainForm ? 'Cancel' : 'Add Domain'}
            </button>
          </div>
          {showDomainForm && (
            <form className="row g-2 mb-3" onSubmit={handleCreateDomain}>
              <div className="col-md-10">
                <input
                  className="form-control"
                  value={domainForm.name}
                  onChange={(e) => setDomainForm({ name: e.target.value })}
                  placeholder="Domain name (e.g., Web Development)"
                  required
                />
              </div>
              <div className="col-md-2"><button className="btn btn-primary w-100">Create</button></div>
            </form>
          )}
          {loading ? <div className="spinner-gradient mx-auto"></div> : (
            <div className="list-group">
              {domains.map((d) => (
                <div key={d._id} className="list-group-item d-flex justify-content-between">
                  <span>{d.name}</span>
                  <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteDomain(d._id)}>Delete</button>
                </div>
              ))}
              {!domains.length && <div className="text-muted">No domains found</div>}
            </div>
          )}
        </div>
      )}

      {activeTab === 'roles' && (
        <div className="card-modern p-3">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h5 className="mb-0">Career Paths</h5>
            <button className="btn btn-sm btn-gradient" onClick={() => {
              if (showRoleForm) {
                resetRoleForm();
              }
              setShowRoleForm(!showRoleForm);
            }}>{showRoleForm ? 'Cancel' : 'Add Career Path'}</button>
          </div>
          {showRoleForm && (
            <form className="mb-3" onSubmit={handleSubmitRole}>
              <div className="row g-3">
                <div className="col-md-6">
                  <label className="form-label text-dark">Role Name *</label>
                  <input className="form-control" value={roleForm.roleName} onChange={(e)=>setRoleForm({...roleForm,roleName:e.target.value})} placeholder="e.g. Full Stack Developer" required />
                </div>
                <div className="col-md-6">
                  <label className="form-label text-dark">Domain *</label>
                  <select
                    className="form-select"
                    value={roleForm.domain}
                    onChange={(e)=>setRoleForm({...roleForm,domain:e.target.value})}
                    required
                  >
                    <option value="">Select domain</option>
                    {domains.map((d) => (
                      <option key={`role-domain-${d._id}`} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label text-dark">Min CGPA *</label>
                  <input type="number" step="0.1" className="form-control" value={roleForm.minCGPA} onChange={(e)=>setRoleForm({...roleForm,minCGPA:parseFloat(e.target.value||0)})} placeholder="0-10" required />
                </div>
                <div className="col-md-3">
                  <label className="form-label text-dark">Min Projects</label>
                  <input type="number" className="form-control" value={roleForm.minProjects} onChange={(e)=>setRoleForm({...roleForm,minProjects:parseInt(e.target.value||0)})} placeholder="0" />
                </div>
                <div className="col-12">
                  <label className="form-label text-dark">Description</label>
                  <textarea className="form-control" rows="2" value={roleForm.description} onChange={(e)=>setRoleForm({...roleForm,description:e.target.value})} placeholder="Brief description of the role" />
                </div>

                <div className="col-12">
                  <label className="form-label text-dark">Required Skills * (must select at least one)</label>
                  {skills.length === 0 ? (
                    <div className="alert alert-warning">Please add skills first in the Skills tab</div>
                  ) : (
                    <div className="row g-2">
                      {skills.map((skill) => (
                        <div key={skill._id} className="col-md-4">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`role-skill-${skill._id}`}
                              checked={roleForm.requiredSkills.includes(skill._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRoleForm({...roleForm, requiredSkills: [...roleForm.requiredSkills, skill._id]});
                                } else {
                                  setRoleForm({...roleForm, requiredSkills: roleForm.requiredSkills.filter(id => id !== skill._id)});
                                }
                              }}
                            />
                            <label className="form-check-label text-dark" htmlFor={`role-skill-${skill._id}`}>{skill.name}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-12">
                  <label className="form-label text-dark">Related Interests/Domains</label>
                  {interests.length === 0 ? (
                    <div className="alert alert-warning">Please add interests first in the Interests tab</div>
                  ) : (
                    <div className="row g-2">
                      {interests.map((interest) => (
                        <div key={interest._id} className="col-md-4">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`role-interest-${interest._id}`}
                              checked={roleForm.relatedInterests.includes(interest._id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setRoleForm({...roleForm, relatedInterests: [...roleForm.relatedInterests, interest._id]});
                                } else {
                                  setRoleForm({...roleForm, relatedInterests: roleForm.relatedInterests.filter(id => id !== interest._id)});
                                }
                              }}
                            />
                            <label className="form-check-label text-dark" htmlFor={`role-interest-${interest._id}`}>{interest.name}</label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="col-12 mt-4">
                  <h6 className="text-dark mb-2">Learning Roadmap *</h6>
                  <p className="text-muted small">Define topics for each learning level (separate topics with commas)</p>
                </div>

                <div className="col-md-4">
                  <label className="form-label text-dark">Beginner Topics *</label>
                  <textarea 
                    className="form-control" 
                    rows="3"
                    placeholder="HTML, CSS, JavaScript basics"
                    value={roleForm.roadmap.beginner.topics.join(', ')}
                    onChange={(e) => setRoleForm({
                      ...roleForm, 
                      roadmap: {
                        ...roleForm.roadmap,
                        beginner: {
                          ...roleForm.roadmap.beginner,
                          topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        }
                      }
                    })}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label text-dark">Intermediate Topics *</label>
                  <textarea 
                    className="form-control" 
                    rows="3"
                    placeholder="React, Node.js, REST APIs"
                    value={roleForm.roadmap.intermediate.topics.join(', ')}
                    onChange={(e) => setRoleForm({
                      ...roleForm, 
                      roadmap: {
                        ...roleForm.roadmap,
                        intermediate: {
                          ...roleForm.roadmap.intermediate,
                          topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        }
                      }
                    })}
                    required
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label text-dark">Advanced Topics *</label>
                  <textarea 
                    className="form-control" 
                    rows="3"
                    placeholder="Microservices, Docker, CI/CD"
                    value={roleForm.roadmap.advanced.topics.join(', ')}
                    onChange={(e) => setRoleForm({
                      ...roleForm, 
                      roadmap: {
                        ...roleForm.roadmap,
                        advanced: {
                          ...roleForm.roadmap.advanced,
                          topics: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                        }
                      }
                    })}
                    required
                  />
                </div>

                <div className="col-12">
                  <button type="submit" className="btn btn-primary" disabled={roleForm.requiredSkills.length === 0}>
                    {editingRoleId ? 'Update Career Path' : 'Create Career Path'}
                  </button>
                  <button type="button" className="btn btn-secondary ms-2" onClick={() => { setShowRoleForm(false); resetRoleForm(); }}>
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          )}
          {loading ? <div className="spinner-gradient mx-auto"></div> : (
            <div className="list-group">
              {roles.map((r) => (
                <div key={r._id} className="list-group-item d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-semibold">{r.roleName}</div>
                    <small className="text-muted">
                      CGPA {r.minCGPA} | Projects {r.minProjects} | 
                      {r.requiredSkills?.length > 0 ? ` ${r.requiredSkills.length} required skills` : ' No skills'}
                    </small>
                    {r.description && <div className="small text-muted mt-1">{r.description}</div>}
                  </div>
                  <div className="d-flex gap-2">
                    <button className="btn btn-sm btn-outline-primary" onClick={() => handleEditRole(r)}>Edit</button>
                    <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteRole(r._id)}>Delete</button>
                  </div>
                </div>
              ))}
              {!roles.length && <div className="text-muted">No career paths found</div>}
            </div>
          )}
        </div>
      )}
    </FacultyLayout>
  );
}

