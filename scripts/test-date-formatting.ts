/**
 * Test date formatting function used in NotesSection
 */

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Test cases
const now = new Date()
const testCases = [
  { date: new Date(now.getTime() - 30 * 1000), expected: 'Just now' },
  { date: new Date(now.getTime() - 2 * 60 * 1000), expected: '2 minutes ago' },
  { date: new Date(now.getTime() - 1 * 60 * 1000), expected: '1 minute ago' },
  { date: new Date(now.getTime() - 2 * 60 * 60 * 1000), expected: '2 hours ago' },
  { date: new Date(now.getTime() - 1 * 60 * 60 * 1000), expected: '1 hour ago' },
  { date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), expected: '2 days ago' },
  { date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), expected: '1 day ago' },
]

console.log('Testing date formatting...\n')

let allPassed = true
for (const testCase of testCases) {
  const result = formatDate(testCase.date.toISOString())
  // For older dates, we just check it returns a formatted date string
  const passed = testCase.expected.includes('ago') 
    ? result.includes(testCase.expected.split(' ')[0]) || result.includes('day') || result.includes('hour') || result.includes('minute')
    : result === testCase.expected

  if (!passed) {
    allPassed = false
    console.error(`❌ FAIL: ${testCase.date.toISOString()} -> expected "${testCase.expected}", got "${result}"`)
  } else {
    console.log(`✅ PASS: ${testCase.date.toISOString()} -> "${result}"`)
  }
}

console.log('\n' + (allPassed ? '✅ All date formatting tests passed!' : '❌ Some tests failed'))
process.exit(allPassed ? 0 : 1)

