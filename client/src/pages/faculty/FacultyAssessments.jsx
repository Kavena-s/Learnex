import { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';
import useAutoRefresh from '../../hooks/useAutoRefresh';

export default function FacultyAssessments() {
  useAuth();
  const [assessments, setAssessments] = useState([]);
  const [profilesByUserId, setProfilesByUserId] = useState({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const isFinalAssessment = (assessment) => {
    const skill = String(assessment?.skillName || assessment?.skillId?.name || '').trim().toLowerCase();
    return skill === 'final assessment';
  };

  const fetchAssessments = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const token = authService.getToken();
      const params = { scope: 'final' };
      if (filter !== 'all') params.status = filter;
      const [assessmentRes, profilesRes] = await Promise.all([
        axios.get('http://localhost:5000/api/faculty/assessments', {
          headers: { Authorization: `Bearer ${token}` },
          params,
        }),
        axios.get('http://localhost:5000/api/profile/all', {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const items = Array.isArray(assessmentRes.data)
        ? assessmentRes.data
        : (assessmentRes.data?.assessments || []);

      const profileMap = {};
      (profilesRes.data || []).forEach((p) => {
        if (p?.userId) profileMap[String(p.userId)] = p;
      });

      setProfilesByUserId(profileMap);
      setAssessments(items.filter(isFinalAssessment));
    } catch (err) { console.error('Failed to fetch assessments:', err); }
    finally { if (!silent) setLoading(false); }
  };

  useEffect(() => { fetchAssessments(); }, [filter]);
  useAutoRefresh(fetchAssessments, { intervalMs: 30000 });

  const filteredAssessments = assessments.filter((a) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const studentName = a.studentId?.name?.toLowerCase() || '';
    const studentEmail = a.studentId?.email?.toLowerCase() || '';
    const status = a.status?.toLowerCase() || '';
    const level = a.level?.toLowerCase() || '';
    const skill = (a.skillName || a.skillId?.name || '').toLowerCase();
    const role = String(a.roleId?.roleName || '').toLowerCase();

    return studentName.includes(term) || studentEmail.includes(term) || status.includes(term) || level.includes(term) || skill.includes(term) || role.includes(term);
  });

  const handleScheduleAssessment = async (assessmentId) => {
    const scheduledDate = prompt('Enter date (YYYY-MM-DD):');
    if (!scheduledDate) return;
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(scheduledDate)) {
      alert('Invalid date format. Please use YYYY-MM-DD');
      return;
    }

    const timeSlot = prompt('Enter time slot (FN for Forenoon / AN for Afternoon):');
    if (!timeSlot) return;
    
    const slot = String(timeSlot).toUpperCase().trim();
    if (!['FN', 'AN'].includes(slot)) {
      alert('Invalid time slot. Please enter FN (Forenoon) or AN (Afternoon)');
      return;
    }

    try {
      const token = authService.getToken();
      await axios.post(
        `http://localhost:5000/api/faculty/assessments/${assessmentId}/schedule`,
        { scheduledDate, timeSlot: slot },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchAssessments();
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.response?.data?.error || err.message || 'Failed to schedule assessment';
      const details = err.response?.data?.details ? `\n\nDetails: ${err.response.data.details}` : '';
      alert(`Error: ${errorMsg}${details}`);
      console.error('Schedule error:', err.response?.data || err.message);
    }
  };

  const handleCompleteAssessment = async (assessmentId, result) => {
    if (!result) return;
    try {
      const token = authService.getToken();
      await axios.put(
        `http://localhost:5000/api/faculty/assessments/${assessmentId}/complete`,
        {
          result: String(result).toLowerCase(),
          facultyNotes: result === 'passed'
            ? 'Final assessment passed. Student marked as qualified for selected role.'
            : 'Final assessment needs improvement. Student is not yet role-qualified.',
        },
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
          placeholder="Search by student name, email, status, level, or role..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="card-modern p-0 overflow-hidden mb-3">
        {loading ? <div className="p-4 text-center"><div className="spinner-gradient mx-auto"></div></div> : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead><tr><th>Student</th><th>Role</th><th>Skill</th><th>Level</th><th>Status</th><th>Qualification</th><th>Date</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredAssessments.map((a, idx)=>{
                  const studentProfile = profilesByUserId[String(a.studentId?._id)] || null;
                  const roleLabel =
                    studentProfile?.selectedRole?.trackName ||
                    studentProfile?.selectedRole?.roleId?.roleName ||
                    a.roleId?.roleName ||
                    'Not selected';
                  const isQualified = Boolean(studentProfile?.selectedRole?.finalAssessmentPassed);
                  const statusBadgeClass =
                    a.status === 'requested'
                      ? 'text-bg-warning'
                      : a.status === 'scheduled'
                        ? 'text-bg-info'
                        : a.status === 'completed'
                          ? 'text-bg-success'
                          : 'text-bg-secondary';

                  return (
                    <tr key={a._id}>
                      <td><div>{a.studentId?.name || 'Unknown'}</div><small className="text-muted">{a.studentId?.email || ''}</small></td>
                      <td>{roleLabel}</td>
                      <td>{a.skillName || a.skillId?.name || 'N/A'}</td>
                      <td className="text-capitalize">{a.level || 'beginner'}</td>
                      <td><span className={`badge ${statusBadgeClass}`}>{a.status}</span></td>
                      <td>
                        {isQualified ? (
                          <span className="badge text-bg-success">Qualified Role</span>
                        ) : (
                          <span className="badge text-bg-warning">Not Qualified Yet</span>
                        )}
                      </td>
                      <td className="small">{new Date(a.scheduledDate || a.createdAt).toLocaleString()}</td>
                      <td>
                        {a.status === 'requested' && (
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-primary" onClick={()=>handleScheduleAssessment(a._id)}>Schedule</button>
                            <button className="btn btn-sm btn-outline-danger" onClick={()=>handleDeclineAssessment(a._id)}>Decline</button>
                          </div>
                        )}
                        {a.status === 'scheduled' && (
                          <div className="d-flex gap-2">
                            <button className="btn btn-sm btn-outline-success" onClick={()=>handleCompleteAssessment(a._id, 'passed')}>Mark Passed</button>
                            <button className="btn btn-sm btn-outline-warning" onClick={()=>handleCompleteAssessment(a._id, 'needs_improvement')}>Needs Improvement</button>
                          </div>
                        )}
                        {a.status === 'declined' && <span className="text-muted small">Declined</span>}
                        {a.status === 'completed' && <span className="text-success small">Completed</span>}
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

