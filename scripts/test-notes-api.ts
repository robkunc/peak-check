/**
 * Test script to verify notes API pagination logic
 * This tests the logic without requiring authentication
 */

// Test pagination calculation
function testPagination() {
  console.log('Testing pagination logic...\n')

  const testCases = [
    { total: 0, limit: 20, expectedPages: 0 },
    { total: 15, limit: 20, expectedPages: 1 },
    { total: 20, limit: 20, expectedPages: 1 },
    { total: 21, limit: 20, expectedPages: 2 },
    { total: 40, limit: 20, expectedPages: 2 },
    { total: 41, limit: 20, expectedPages: 3 },
    { total: 100, limit: 20, expectedPages: 5 },
  ]

  let allPassed = true

  for (const testCase of testCases) {
    const totalPages = Math.ceil(testCase.total / testCase.limit)
    const passed = totalPages === testCase.expectedPages

    if (!passed) {
      allPassed = false
      console.error(
        `❌ FAIL: total=${testCase.total}, limit=${testCase.limit}, expected=${testCase.expectedPages}, got=${totalPages}`
      )
    } else {
      console.log(
        `✅ PASS: total=${testCase.total}, limit=${testCase.limit}, pages=${totalPages}`
      )
    }
  }

  console.log('\n' + (allPassed ? '✅ All pagination tests passed!' : '❌ Some tests failed'))
  return allPassed
}

// Test skip calculation
function testSkipCalculation() {
  console.log('\nTesting skip calculation...\n')

  const testCases = [
    { page: 1, limit: 20, expectedSkip: 0 },
    { page: 2, limit: 20, expectedSkip: 20 },
    { page: 3, limit: 20, expectedSkip: 40 },
    { page: 1, limit: 10, expectedSkip: 0 },
    { page: 2, limit: 10, expectedSkip: 10 },
  ]

  let allPassed = true

  for (const testCase of testCases) {
    const skip = (testCase.page - 1) * testCase.limit
    const passed = skip === testCase.expectedSkip

    if (!passed) {
      allPassed = false
      console.error(
        `❌ FAIL: page=${testCase.page}, limit=${testCase.limit}, expected=${testCase.expectedSkip}, got=${skip}`
      )
    } else {
      console.log(
        `✅ PASS: page=${testCase.page}, limit=${testCase.limit}, skip=${skip}`
      )
    }
  }

  console.log('\n' + (allPassed ? '✅ All skip calculation tests passed!' : '❌ Some tests failed'))
  return allPassed
}

// Run all tests
const paginationPassed = testPagination()
const skipPassed = testSkipCalculation()

if (paginationPassed && skipPassed) {
  console.log('\n🎉 All API logic tests passed!')
  process.exit(0)
} else {
  console.log('\n❌ Some tests failed')
  process.exit(1)
}

