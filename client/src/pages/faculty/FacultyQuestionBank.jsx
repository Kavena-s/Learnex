import { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import FacultyLayout from '../../components/FacultyLayout';
import authService from '../../services/authService';
import useAutoRefresh from '../../hooks/useAutoRefresh';

const LEVELS = ['beginner', 'intermediate', 'advanced'];
const REQUIRED_ASSESSMENT_COUNT = 10;

const emptyQuestion = () => ({
  questionText: '',
  concept: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  tagsText: '',
});

export default function FacultyQuestionBank() {
  useAuth();

  const [skills, setSkills] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedSkill, setSelectedSkill] = useState('');
  const [selectedLevel, setSelectedLevel] = useState('beginner');
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [showQuestionForm, setShowQuestionForm] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState('');
  const [questionCount, setQuestionCount] = useState(3);
  const [questionItems, setQuestionItems] = useState([emptyQuestion(), emptyQuestion(), emptyQuestion()]);

  const tokenHeaders = () => ({ Authorization: `Bearer ${authService.getToken()}` });
  const approvedCountForSelection = questions.filter((q) => q.status === 'approved').length;

  useEffect(() => {
    fetchSkills();
  }, []);

  useEffect(() => {
    if (selectedSkill) {
      fetchQuestions();
    } else {
      setQuestions([]);
      setLoadingQuestions(false);
    }
  }, [selectedSkill, selectedLevel]);

  useEffect(() => {
    if (!showQuestionForm || editingQuestionId) return;
    const n = Math.max(1, Math.min(20, Number(questionCount) || 1));
    setQuestionItems((prev) => {
      if (prev.length === n) return prev;
      if (prev.length > n) return prev.slice(0, n);
      const next = [...prev];
      while (next.length < n) next.push(emptyQuestion());
      return next;
    });
  }, [questionCount, showQuestionForm, editingQuestionId]);

  const fetchSkills = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/faculty/skills', { headers: tokenHeaders() });
      const allSkills = res.data?.skills || [];
      setSkills(allSkills);
      if (!selectedSkill && allSkills.length > 0) {
        setSelectedSkill(allSkills[0].name);
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    }
  };

  const fetchQuestions = async ({ silent = false } = {}) => {
    if (!silent) setLoadingQuestions(true);
    try {
      const params = {
        skillName: selectedSkill,
        difficultyLevel: selectedLevel,
      };
      const res = await axios.get('http://localhost:5000/api/faculty/questions', { headers: tokenHeaders(), params });
      setQuestions(res.data.questions || []);
    } catch (err) {
      console.error('Failed to fetch questions:', err);
    } finally {
      if (!silent) setLoadingQuestions(false);
    }
  };

  useAutoRefresh(async ({ silent = true } = {}) => {
    await fetchSkills();
    if (selectedSkill) {
      await fetchQuestions({ silent });
    }
  }, { intervalMs: 30000 });

  const resetQuestionForm = () => {
    setEditingQuestionId('');
    setQuestionCount(3);
    setQuestionItems([emptyQuestion(), emptyQuestion(), emptyQuestion()]);
  };

  const handleQuestionField = (idx, key, value) => {
    setQuestionItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [key]: value };
      return copy;
    });
  };

  const handleQuestionOptionField = (qIdx, optIdx, value) => {
    setQuestionItems((prev) => {
      const copy = [...prev];
      const options = [...(copy[qIdx].options || [])];
      options[optIdx] = value;
      copy[qIdx] = { ...copy[qIdx], options };
      return copy;
    });
  };

  const handleBulkQuestionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSkill) {
      alert('Select a skill first.');
      return;
    }

    const payload = questionItems.map((q) => ({
      questionText: q.questionText,
      concept: q.concept,
      options: q.options,
      correctAnswer: Number(q.correctAnswer),
      tags: q.tagsText
        ? q.tagsText.split(',').map((t) => t.trim()).filter(Boolean)
        : [],
    }));

    try {
      if (editingQuestionId) {
        await axios.put(
          `http://localhost:5000/api/faculty/questions/${editingQuestionId}`,
          { skillName: selectedSkill, difficultyLevel: selectedLevel, ...payload[0] },
          { headers: tokenHeaders() }
        );
      } else {
        await axios.post(
          'http://localhost:5000/api/faculty/questions/by-skill',
          { skillName: selectedSkill, difficultyLevel: selectedLevel, questions: payload },
          { headers: tokenHeaders() }
        );
      }

      setShowQuestionForm(false);
      resetQuestionForm();
      await fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to save questions');
    }
  };

  const startEditQuestion = (question) => {
    setShowQuestionForm(true);
    setEditingQuestionId(question._id);
    setSelectedSkill(question.skillName || selectedSkill);
    setSelectedLevel(question.difficultyLevel || 'beginner');
    setQuestionCount(1);
    setQuestionItems([
      {
        questionText: question.questionText || '',
        concept: question.concept || '',
        options: (question.options && question.options.length ? [...question.options] : ['', '', '', '']),
        correctAnswer: Number(question.correctAnswer || 0),
        tagsText: (question.tags || []).join(', '),
      },
    ]);
  };

  const handleApprove = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/faculty/questions/${id}/approve`, {}, { headers: tokenHeaders() });
      await fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve question');
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Reason for rejection (optional):');
    try {
      await axios.put(`http://localhost:5000/api/faculty/questions/${id}/reject`, { reason }, { headers: tokenHeaders() });
      await fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject question');
    }
  };

  const handleDeleteQuestion = async (id) => {
    if (!confirm('Delete this question?')) return;
    try {
      await axios.delete(`http://localhost:5000/api/faculty/questions/${id}`, { headers: tokenHeaders() });
      await fetchQuestions();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete question');
    }
  };

  return (
    <FacultyLayout>
      <h2 className="text-white fw-bold mb-3">Question Bank Management</h2>

      <div className="card-modern p-3 mb-3">
        <div className="mb-2 fw-semibold text-dark">Classify By Skill</div>
        <div className="d-flex flex-wrap gap-2 mb-3">
          {skills.map((s) => (
            <button
              key={s._id}
              className={`btn btn-sm ${selectedSkill === s.name ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelectedSkill(s.name)}
            >
              {s.name}
            </button>
          ))}
          {!skills.length && <span className="text-secondary">No skills in dataset. Add skills first in Faculty Datasets.</span>}
        </div>

        <div className="mb-2 fw-semibold text-dark">Levels</div>
        <div className="d-flex flex-wrap gap-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              className={`btn btn-sm text-capitalize ${selectedLevel === lvl ? 'btn-success' : 'btn-outline-success'}`}
              onClick={() => setSelectedLevel(lvl)}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      <div className="row g-2 mb-3">
        <div className="col-12 d-flex gap-2">
          <button
            className="btn btn-success"
            onClick={() => {
              if (!selectedSkill) {
                alert('Please select a skill first.');
                return;
              }
              setShowQuestionForm((v) => !v);
              if (showQuestionForm) resetQuestionForm();
            }}
          >
            {showQuestionForm ? 'Cancel' : `Add ${selectedLevel} Questions for ${selectedSkill || 'Skill'}`}
          </button>
        </div>
      </div>

      <div className="card-modern p-3 mb-3">
        <div className="d-flex flex-wrap gap-2 align-items-center">
          <span className="badge text-bg-info">
            Available ({selectedSkill || 'Skill'} - {selectedLevel}): {approvedCountForSelection}
          </span>
          <span className="badge text-bg-secondary">Required per assessment: {REQUIRED_ASSESSMENT_COUNT}</span>
        </div>
        {approvedCountForSelection < REQUIRED_ASSESSMENT_COUNT && (
          <div className="alert alert-warning mt-3 mb-0">
            Low question bank for this skill and level. Add at least {REQUIRED_ASSESSMENT_COUNT - approvedCountForSelection} more approved question(s)
            to avoid short assessments.
          </div>
        )}
      </div>

      {showQuestionForm && (
        <form className="card-modern p-3 mb-3" onSubmit={handleBulkQuestionSubmit}>
          {!editingQuestionId && (
            <div className="row g-2 mb-3">
              <div className="col-md-4">
                <label className="form-label text-dark">Number of questions</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  className="form-control"
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value || 1))}
                />
              </div>
            </div>
          )}

          {questionItems.map((item, qIdx) => (
            <div key={qIdx} className="border rounded p-3 mb-3">
              <h6 className="mb-2 text-dark">{editingQuestionId ? 'Edit Question' : `Question ${qIdx + 1}`}</h6>
              <div className="row g-2">
                <div className="col-md-8">
                  <input
                    className="form-control"
                    placeholder="Question text"
                    value={item.questionText}
                    onChange={(e) => handleQuestionField(qIdx, 'questionText', e.target.value)}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <input
                    className="form-control"
                    placeholder="Concept"
                    value={item.concept}
                    onChange={(e) => handleQuestionField(qIdx, 'concept', e.target.value)}
                    required
                  />
                </div>

                {(item.options || []).map((opt, optIdx) => (
                  <div className="col-md-6" key={optIdx}>
                    <div className="input-group">
                      <span className="input-group-text">
                        <input
                          type="radio"
                          checked={Number(item.correctAnswer) === optIdx}
                          onChange={() => handleQuestionField(qIdx, 'correctAnswer', optIdx)}
                        />
                      </span>
                      <input
                        className="form-control"
                        placeholder={`Option ${optIdx + 1}`}
                        value={opt}
                        onChange={(e) => handleQuestionOptionField(qIdx, optIdx, e.target.value)}
                        required
                      />
                    </div>
                  </div>
                ))}

                <div className="col-12">
                  <input
                    className="form-control"
                    placeholder="Tags (comma separated)"
                    value={item.tagsText}
                    onChange={(e) => handleQuestionField(qIdx, 'tagsText', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}

          <button className="btn btn-primary">{editingQuestionId ? 'Update Question' : 'Save Questions'}</button>
        </form>
      )}

      <div className="card-modern p-0 overflow-hidden">
        {loadingQuestions ? (
          <div className="p-4 text-center"><div className="spinner-gradient mx-auto"></div></div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover mb-0">
              <thead>
                <tr>
                  <th className="text-dark">Skill</th>
                  <th className="text-dark">Concept</th>
                  <th className="text-dark">Question</th>
                  <th className="text-dark">Actions</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q._id}>
                    <td className="text-dark">{q.skillName}</td>
                    <td className="text-dark">{q.concept}</td>
                    <td className="text-dark">{q.questionText}</td>
                    <td className="d-flex gap-1 flex-wrap">
                      {q.status === 'pending' && <button className="btn btn-sm btn-outline-success" onClick={() => handleApprove(q._id)}>Approve</button>}
                      {q.status === 'pending' && <button className="btn btn-sm btn-outline-warning" onClick={() => handleReject(q._id)}>Reject</button>}
                      <button className="btn btn-sm btn-outline-primary" onClick={() => startEditQuestion(q)}>Edit</button>
                      <button className="btn btn-sm btn-outline-danger" onClick={() => handleDeleteQuestion(q._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!questions.length && (
                  <tr>
                    <td colSpan="4" className="text-center text-secondary py-4">
                      No questions found for {selectedSkill || 'selected skill'} ({selectedLevel})
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FacultyLayout>
  );
}

