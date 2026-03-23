import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';

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

  const fetchStudents = async () => {
    try {
      const token = authService.getToken();
      const profilesRes = await axios.get('http://localhost:5000/api/profile/all', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStudents(profilesRes.data);
    } catch (err) {
      console.error('Failed to fetch students:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const handleQualifySkill = async (assessment) => {
    try {
      const token = authService.getToken();
      await axios.put(
        `http://localhost:5000/api/faculty/assessments/${assessment._id}/qualify-skill`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Refresh modal data after qualification
      if (selectedStudent?.userId) {
        const [profilesRes, historyRes] = await Promise.all([
          axios.get('http://localhost:5000/api/profile/all', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          axios.get(`http://localhost:5000/api/faculty/assessments/student/${selectedStudent.userId}`, {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        const updatedStudent = (profilesRes.data || []).find((p) => p.userId === selectedStudent.userId);
        if (updatedStudent) {
          setSelectedStudent((prev) => ({ ...prev, ...updatedStudent }));
        }
        setAssessmentHistory(historyRes.data.assessments || []);
      }

      alert('Skill qualified successfully and updated in profile');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to qualify skill');
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

                {selectedStudent.qualifiedSkills?.length > 0 && (
                  <div className="mb-4">
                    <h6 className="mb-2">Qualified Skills</h6>
                    <div className="d-flex flex-wrap gap-2">
                      {selectedStudent.qualifiedSkills.map((q) => (
                        <span key={`${q.skillName}-${q.level}`} className="badge text-bg-success">
                          {q.skillName} ({q.level})
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {assessmentHistory.length > 0 && (
                  <div className="mt-4">
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
                            <th>Action</th>
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
                              <td>
                                {assess.status === 'completed' && !/^final assessment$/i.test(String(assess.skillName || assess.skillId?.name || '')) ? (
                                  <button
                                    className="btn btn-sm btn-outline-success"
                                    onClick={() => handleQualifySkill(assess)}
                                  >
                                    Qualify
                                  </button>
                                ) : (
                                  <span className="text-muted small">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary by Skill and Level */}
                    <div className="mt-3">
                      <h6 className="mb-2">Summary by Skill</h6>
                      {(() => {
                        const skillMap = {};
                        assessmentHistory.forEach(a => {
                          if (a.status !== 'completed') return;
                          const skill = a.skillName || a.skillId?.name || 'Unknown';
                          const level = a.level || 'beginner';
                          if (!skillMap[skill]) {
                            skillMap[skill] = { beginner: [], intermediate: [], advanced: [] };
                          }
                          if (skillMap[skill][level]) {
                            skillMap[skill][level].push(a.score || 0);
                          }
                        });

                        return (
                          <div className="row g-2">
                            {Object.entries(skillMap).map(([skill, levels]) => (
                              <div key={skill} className="col-12">
                                <div className="p-3 border rounded">
                                  <strong>{skill}</strong>
                                  <div className="d-flex gap-3 mt-2 small">
                                    {['beginner', 'intermediate', 'advanced'].map(lvl => {
                                      const scores = levels[lvl];
                                      if (!scores || scores.length === 0) return null;
                                      const best = Math.max(...scores);
                                      const attempts = scores.length;
                                      return (
                                        <div key={lvl}>
                                          <span className="text-muted text-capitalize">{lvl}:</span>{' '}
                                          <strong className={best >= 90 ? 'text-success' : best >= 50 ? 'text-warning' : 'text-danger'}>
                                            {best}%
                                          </strong> ({attempts} attempt{attempts !== 1 ? 's' : ''})
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
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

