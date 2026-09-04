/* ─── Mock flow/question dataset — shared by Sheets question-mapping and CRM Triggers ── */

export const MOCK_FLOWS = [
  { id: 'main', name: 'Main Flow', questions: [
    { id: 'q1', label: 'What is your name?' },
    { id: 'q2', label: 'Enter your mobile number' },
    { id: 'q3', label: 'Enter your email' },
  ] },
  { id: 'support', name: 'Support Flow', questions: [
    { id: 'q4', label: 'What issue are you facing?' },
    { id: 'q5', label: 'Order ID' },
  ] },
  { id: 'leadgen', name: 'Lead Generation', questions: [
    { id: 'q6', label: 'Company name' },
    { id: 'q7', label: 'Budget range' },
  ] },
]

export function findFlowQuestion(flowId, questionId) {
  const flow = MOCK_FLOWS.find(f => f.id === flowId)
  return flow?.questions.find(q => q.id === questionId)
}
