import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';

export default function FacultyAssessments() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const isFinalAssessment = (assessment) => {
    const skill = String(assessment?.skillName || assessment?.skillId?.name || '').trim().toLowerCase();
    return skill === 'final assessment';
  };

  useEffect(() => { fetchAssessments(); }, [filter]);

  const fetchAssessments = async () => {
    setLoading(true);
    try {
      const token = authService.getToken();
      const params = { scope: 'final' };
      if (filter !== 'all') params.status = filter;
      const res = await axios.get('http://localhost:5000/api/faculty/assessments', { headers: { Authorization: `Bearer ${token}` }, params });
      const items = Array.isArray(res.data) ? res.data : (res.data?.assessments || []);
      setAssessments(items.filter(isFinalAssessment));
    } catch (err) { console.error('Failed to fetch assessments:', err); }
    finally { setLoading(false); }
  };

  const filteredAssessments = assessments.filter((a) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const studentName = a.studentId?.name?.toLowerCase() || '';
    const studentEmail = a.studentId?.email?.toLowerCase() || '';
    const status = a.status?.toLowerCase() || '';
    const level = a.level?.toLowerCase() || '';
    const skill = (a.skillName || a.skillId?.name || '').toLowerCase();

    return studentName.includes(term) || studentEmail.includes(term) || status.includes(term) || level.includes(term) || skill.includes(term);
  });

  const handleScheduleAssessment = async (assessmentId) => {
    const scheduledDate = prompt('Enter scheduled date (YYYY-MM-DD):');
    if (!scheduledDate) return;
    const mode = prompt('Enter mode (online/offline):', 'online');
    if (!mode) return;
    try {
      const token = authService.getToken();
      await axios.post(
        `http://localhost:5000/api/faculty/assessments/${assessmentId}/schedule`,
        { scheduledDate, mode: String(mode).toLowerCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAssessments();
    } catch (err) { alert(err.response?.data?.message || 'Failed to schedule assessment'); }
  };

  const handleCompleteAssessment = async (assessmentId) => {
    const result = prompt("Enter result (passed/needs_improvement):", 'passed');
    if (!result) return;
    try {
      const token = authService.getToken();
      await axios.put(
        `http://localhost:5000/api/faculty/assessments/${assessmentId}/complete`,
        { result: String(result).toLowerCase() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAssessments();
    } catch (err) { alert(err.response?.data?.message || 'Failed to complete assessment'); }
  };

  const handleDeclineAssessment = async (assessmentId) => {
    const reason = prompt('Enter decline reason:', 'Not eligible yet for final assessment');
    if (reason === null) return;
    try {
      const token = authService.getToken();
      await axios.put(
        `http://localhost:5000/api/faculty/assessments/${assessmentId}/decline`,
        { reason },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAssessments();
    } catch (err) { alert(err.response?.data?.message || 'Failed to decline assessment'); }
  };

  return (
    <FacultyLayout>
      <h2 className="text-white fw-bold mb-3">Final Assessment Management</h2>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        {['all','requested','scheduled','completed','declined'].map((s)=><button key={s} className={`btn btn-sm ${filter===s?'btn-primary':'btn-outline-light'}`} onClick={()=>setFilter(s)}>{s}</button>)}
      </div>
      <div className="card-modern p-3 mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search by student name, email, status, or level..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card-modern p-0 overflow-hidden mb-3">
        {loading ? <div className="p-4 text-center"><div className="spinner-gradient mx-auto"></div></div> : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead><tr><th>Student</th><th>Skill</th><th>Level</th><th>Status</th><th>Score</th><th>Attempt #</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredAssessments.map((a, idx)=>{
                  // Count how many times this student attempted this skill/level before this assessment
                  const priorAttempts = filteredAssessments.filter((other, otherIdx) => 
                    otherIdx > idx && 
                    other.studentId?._id === a.studentId?._id && 
                    (other.skillName || other.skillId?.name) === (a.skillName || a.skillId?.name) &&
                    other.level === a.level &&
                    other.status === 'completed'
                  ).length;
                  const attemptNumber = priorAttempts + 1;

                  return (
                    <tr key={a._id}>
                      <td><div>{a.studentId?.name || 'Unknown'}</div><small className="text-muted">{a.studentId?.email || ''}</small></td>
                      <td>{a.skillName || a.skillId?.name || 'N/A'}</td>
                      <td className="text-capitalize">{a.level || 'beginner'}</td>
                      <td><span className="badge text-bg-secondary">{a.status}</span></td>
                      <td>
                        {a.score != null ? (
                          <span className={`badge ${
                            a.score >= 90 ? 'text-bg-success' : 
                            a.score >= 50 ? 'text-bg-warning' : 
                            'text-bg-danger'
                          }`}>
                            {a.score}%
                          </span>
                        ) : '-'}
                      </td>
                      <td>
                        {a.status === 'completed' && attemptNumber > 1 ? (
                          <span className="badge text-bg-info">Attempt #{attemptNumber}</span>
                        ) : a.status === 'completed' ? (
                          <span className="text-muted small">First</span>
                        ) : '-'}
                      </td>
                      <td className="small">{new Date(a.scheduledDate || a.createdAt).toLocaleString()}</td>
                      <td>
                        {a.status === 'requested' && (
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-primary" onClick={()=>handleScheduleAssessment(a._id)}>Schedule</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDeclineAssessment(a._id)}>Decline</button>
                          </div>
                        )}
                        {a.status === 'scheduled' && <button className="btn btn-sm btn-outline-success" onClick={()=>handleCompleteAssessment(a._id)}>Complete</button>}
                        {a.status === 'declined' && <span className="text-muted small">Declined</span>}
                      </td>
                    </tr>
                  );
                })}
                {!filteredAssessments.length && <tr><td colSpan="8" className="text-center text-muted py-4">No final assessments found</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
}

