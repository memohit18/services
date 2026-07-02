export function extractPythonCallableName(code: string): string {
  const classIndex = code.search(/class\s+Solution\s*:/);
  if (classIndex >= 0) {
    const classSection = code.slice(classIndex);
    const methodMatch = classSection.match(/def\s+(\w+)\s*\(\s*self\b/);
    if (methodMatch) {
      return methodMatch[1];
    }
  }

  const functionMatch = code.match(/^\s*def\s+(\w+)\s*\(/m);
  if (functionMatch) {
    return functionMatch[1];
  }

  throw new Error('No solution function found in Python code');
}

export function extractJavaScriptCallableName(code: string): string {
  const classMatch = code.match(/class\s+Solution\s*{([^}]*)}/s);
  if (classMatch) {
    const methodMatch = classMatch[1].match(/(\w+)\s*\([^)]*\)\s*{/);
    if (methodMatch && methodMatch[1] !== 'constructor') {
      return methodMatch[1];
    }
  }

  const patterns = [
    /(?:async\s+)?function\s+(\w+)\s*\(/,
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)/,
    /(\w+)\s*:\s*(?:async\s*)?function\s*\(/,
  ];

  for (const pattern of patterns) {
    const match = code.match(pattern);
    if (match?.[1] && match[1] !== 'Solution') {
      return match[1];
    }
  }

  throw new Error('No solution function found in JavaScript code');
}
