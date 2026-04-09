import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';
import useAutoRefresh from '../../hooks/useAutoRefresh';

export default function FacultyStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [assessmentHistory, setAssessmentHistory] = useState([]);

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const token = authService.getToken();
      const profilesRes = await axios.get('http://localhost:5000/api/profile/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(profilesRes.data);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useAutoRefresh(fetchStudents, { intervalMs: 30000 });

  const viewStudentDetails = async (studentProfile) => {
    try {
      const token = authService.getToken();
      
      // Fetch readiness data
      let readinessData = null;
      if (studentProfile.selectedRole?.roleId) {
        try {
          const readinessRes = await axios.get(`http://localhost:5000/api/recommend/readiness/${studentProfile.userId}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          readinessData = readinessRes.data;
        } catch (err) {
          console.error('Failed to fetch readiness:', err);
        }
      }
      
      // Fetch assessment history
      try {
        const historyRes = await axios.get(`http://localhost:5000/api/faculty/assessments/student/${studentProfile.userId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setAssessmentHistory(historyRes.data.assessments || []);
      } catch (err) {
        console.error('Failed to fetch assessment history:', err);
        setAssessmentHistory([]);
      }
      
      setSelectedStudent({ ...studentProfile, readiness: readinessData });
      setShowModal(true);
    } catch (err) {
      console.error('Failed to fetch student details:', err);
      setSelectedStudent(studentProfile);
      setAssessmentHistory([]);
      setShowModal(true);
    }
  };

  const filteredStudents = students.filter((student) =>
    student.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.department?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <FacultyLayout>
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-2 mb-3">
        <div>
          <h2 className="text-white fw-bold mb-1">Student Monitoring</h2>
          <p className="text-white mb-0" style={{ opacity: 0.9 }}>Track student profiles and progress</p>
        </div>
        <span className="badge text-bg-info align-self-start align-self-md-auto">Total: {students.length}</span>
      </div>

      <div className="card-modern p-3 mb-3">
        <input
          type="text"
          placeholder="Search by name, email, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="form-control"
        />
      </div>

      <div className="card-modern p-0 overflow-hidden">
        {loading ? (
          <div className="p-4 text-center"><div className="spinner-gradient mx-auto"></div></div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Department</th>
                  <th>CGPA</th>
                  <th>Role</th>
                  <th>Skills</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student._id}>
                    <td>
                      <div className="fw-semibold">{student.name}</div>
                      <small className="text-muted">{student.email}</small>
                    </td>
                    <td>{student.department || 'N/A'}</td>
                    <td>{student.cgpa ? student.cgpa.toFixed(2) : 'N/A'}</td>
                    <td>
                      {student.selectedRole?.trackName || 
                       student.selectedRole?.roleId?.roleName || 
                       'Not selected'}
                    </td>
                    <td>{student.skills?.length || 0}</td>
                    <td>
                      <button onClick={() => viewStudentDetails(student)} className="btn btn-sm btn-outline-primary">View</button>
                    </td>
                  </tr>
                ))}
                {!filteredStudents.length && (
                  <tr><td colSpan="6" className="text-center text-muted py-4">No students found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && selectedStudent && (
        <div className="modal d-block" tabIndex="-1" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Student Profile - {selectedStudent.name}</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row g-3 mb-4">
                  <div className="col-6"><small className="text-muted">Name</small><div>{selectedStudent.name}</div></div>
                  <div className="col-6"><small className="text-muted">Email</small><div>{selectedStudent.email}</div></div>
                  <div className="col-6"><small className="text-muted">Department</small><div>{selectedStudent.department || 'N/A'}</div></div>
                  <div className="col-6"><small className="text-muted">CGPA</small><div>{selectedStudent.cgpa || 'N/A'}</div></div>
                </div>

                {selectedStudent.selectedRole?.finalAssessmentPassed && (
                  <div className="mb-4">
                    <h6 className="mb-2">Current Qualified Role</h6>
                    <div className="mb-2">
                      <span className="badge text-bg-success">
                        {selectedStudent.selectedRole?.trackName || selectedStudent.selectedRole?.roleId?.roleName || 'Qualified Role'}
                      </span>
                    </div>
                    <small className="text-muted d-block mb-2">
                      Final assessment passed. Student is marked proficient in required role skills.
                    </small>
                    <div className="d-flex flex-wrap gap-2">
                      {(selectedStudent.qualifiedSkills || []).map((q) => (
                        <span key={`${q.skillName}-${q.level}`} className="badge text-bg-success">
                          {q.skillName}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(selectedStudent.qualifiedRoles) && selectedStudent.qualifiedRoles.length > 0 && (
                  <div className="mb-4">
                    <h6 className="mb-2">All Qualified Roles</h6>
                    <div className="d-flex flex-wrap gap-2 mb-2">
                      {selectedStudent.qualifiedRoles.map((entry, index) => (
                        <span
                          key={`${entry?.roleId?._id || entry?.roleId || entry?.roleName || 'qualified'}-${index}`}
                          className="badge text-bg-success"
                        >
                          {entry?.trackName || entry?.roleName || entry?.roleId?.roleName || 'Qualified Role'}
                        </span>
                      ))}
                    </div>
                    <ul className="list-group list-group-flush">
                      {selectedStudent.qualifiedRoles.map((entry, index) => (
                        <li
                          key={`qualified-role-date-${entry?.roleId?._id || entry?.roleId || entry?.qualifiedAt || index}`}
                          className="list-group-item px-0"
                        >
                          <div className="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                            <span className="fw-semibold">
                              {entry?.trackName || entry?.roleName || entry?.roleId?.roleName || 'Qualified Role'}
                            </span>
                            <small className="text-muted">
                              {entry?.qualifiedAt
                                ? `Qualified on ${new Date(entry.qualifiedAt).toLocaleString()}`
                                : 'Qualification date unavailable'}
                            </small>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedStudent.selectedRole?.roleId && !selectedStudent.selectedRole?.finalAssessmentPassed && (
                  <div className="mb-4">
                    <h6 className="mb-2">Qualification Status</h6>
                    <span className="badge text-bg-warning">Not Qualified Yet</span>
                    <small className="text-muted d-block mt-2">
                      Role selected, but final assessment is not passed yet.
                    </small>
                  </div>
                )}

                {assessmentHistory.length > 0 && (
                  <div className="mt-4">
                      {/* Skill Summary at Top */}
                      <div className="mb-4 p-3 bg-light rounded">
                        <h6 className="mb-3">Skill Performance Summary</h6>
                        <div className="table-responsive">
                          <table className="table table-sm mb-0">
                            <thead>
                              <tr>
                                <th>Skill</th>
                                <th>Beginner</th>
                                <th>Intermediate</th>
                                <th>Advanced</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(() => {
                                const skillMap = {};
                                assessmentHistory.forEach(a => {
                                  const skill = a.skillName || a.skillId?.name || 'Unknown';
                                  if (!skillMap[skill]) {
                                    skillMap[skill] = {
                                      beginner: { scores: [], attempts: 0 },
                                      intermediate: { scores: [], attempts: 0 },
                                      advanced: { scores: [], attempts: 0 },
                                    };
                                  }
                                  if (a.status === 'completed') {
                                    const level = a.level || 'beginner';
                                    if (skillMap[skill][level]) {
                                      skillMap[skill][level].scores.push(a.score || 0);
                                      skillMap[skill][level].attempts++;
                                    }
                                  }
                                });
                              
                                return Object.entries(skillMap).map(([skill, data]) => {
                                  const beginnerBest = data.beginner.scores.length > 0 ? Math.max(...data.beginner.scores) : 0;
                                  const intermediateBest = data.intermediate.scores.length > 0 ? Math.max(...data.intermediate.scores) : 0;
                                  const advancedBest = data.advanced.scores.length > 0 ? Math.max(...data.advanced.scores) : 0;
                                  const totalAttempts = data.beginner.attempts + data.intermediate.attempts + data.advanced.attempts;
                                  const maxScore = Math.max(beginnerBest, intermediateBest, advancedBest);

                                  const statusBg = maxScore >= 90 ? 'success' : maxScore >= 50 ? 'warning' : 'danger';
                                  const statusText = totalAttempts === 0 ? 'Not Started' : maxScore >= 90 ? 'Excellent' : maxScore >= 50 ? 'In Progress' : 'Needs Work';
                                
                                  return (
                                    <tr key={skill}>
                                      <td><strong>{skill}</strong></td>
                                      <td>{beginnerBest}% ({data.beginner.attempts})</td>
                                      <td>{intermediateBest}% ({data.intermediate.attempts})</td>
                                      <td>{advancedBest}% ({data.advanced.attempts})</td>
                                      <td><span className={`badge text-bg-${statusBg}`}>{statusText}</span></td>
                                    </tr>
                                  );
                                });
                              })()}
                            </tbody>
                          </table>
                        </div>
                      </div>

                    <h6 className="mb-3">Assessment History ({assessmentHistory.length} total)</h6>

                    <div className="table-responsive">
                      <table className="table table-sm table-hover">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Skill</th>
                            <th>Level</th>
                            <th>Score</th>
                            <th>Status</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {assessmentHistory.map((assess, idx) => (
                            <tr key={assess._id}>
                              <td>{idx + 1}</td>
                              <td>{assess.skillName || assess.skillId?.name || 'N/A'}</td>
                              <td className="text-capitalize">{assess.level || 'beginner'}</td>
                              <td>
                                <span className={`badge ${
                                  (assess.score || 0) >= 90 ? 'text-bg-success' : 
                                  (assess.score || 0) >= 50 ? 'text-bg-warning' : 
                                  'text-bg-danger'
                                }`}>
                                  {assess.score || 0}%
                                </span>
                              </td>
                              <td><span className="badge text-bg-secondary">{assess.status}</span></td>
                              <td className="small text-muted">{new Date(assess.createdAt).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                  </div>
                )}

                {assessmentHistory.length === 0 && (
                  <div className="alert alert-info mt-3">No assessment history found for this student.</div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </FacultyLayout>
  );
}

