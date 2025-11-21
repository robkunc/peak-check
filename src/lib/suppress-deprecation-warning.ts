/**
 * Suppress the url.parse() deprecation warning from NextAuth v4
 * 
 * This warning comes from NextAuth v4's internal use of url.parse().
 * The proper fix is to upgrade to NextAuth v5 (Auth.js), but that's a major migration.
 * 
 * This file should be imported early in the application lifecycle to suppress the warning.
 */

if (typeof process !== 'undefined') {
  const originalEmitWarning = process.emitWarning
  
  process.emitWarning = function (warning: any, ...args: any[]) {
    // Suppress the DEP0169 url.parse() deprecation warning from NextAuth v4
    if (
      typeof warning === 'string' &&
      (warning.includes('DEP0169') || warning.includes('url.parse()'))
    ) {
      return
    }
    
    // Also check if it's a DeprecationWarning object
    if (
      typeof warning === 'object' &&
      warning?.name === 'DeprecationWarning' &&
      (warning?.message?.includes('DEP0169') || warning?.message?.includes('url.parse()'))
    ) {
      return
    }
    
    return originalEmitWarning.call(process, warning, ...args)
  }
}

