import { parse, print } from 'graphql';

// Elements
// Elements
const inputEl = document.getElementById('graphql-input');
const outputEl = document.getElementById('graphql-output');
const loadSampleBtn = document.getElementById('load-sample-btn');
const clearBtn = document.getElementById('clear-btn');
const modeBeautify = document.getElementById('mode-beautify');
const modeMinify = document.getElementById('mode-minify');
const copyQueryBtn = document.getElementById('copy-query-btn');
const copyJsonBtn = document.getElementById('copy-json-btn');
const copyCurlBtn = document.getElementById('copy-curl-btn');
const statusBar = document.getElementById('status-bar');
const statusMessage = document.getElementById('status-message');
const charCountEl = document.getElementById('char-count');
const toastEl = document.getElementById('toast');

// New Playground Elements
const navFormatter = document.getElementById('nav-formatter');
const navPlayground = document.getElementById('nav-playground');
const formatterView = document.getElementById('formatter-view');
const playgroundView = document.getElementById('playground-view');
const endpointInput = document.getElementById('endpoint-input');
const headersInput = document.getElementById('headers-input');
const variablesInput = document.getElementById('variables-input');
const runQueryBtn = document.getElementById('run-query-btn');
const playgroundResponse = document.getElementById('playground-response');

// App State
let currentOutput = '';
let activeMode = 'beautify'; // 'beautify' or 'minify'
let isBatchRequest = false;

// Sample GraphQL Query (minified for demonstration)
const sampleQuery = `query ReviewsList($restaurantId:ID!,$pagination:PaginationParams,$sortDirection:SortDirection,$withReview:ReviewFilterEnum,$orderBy:RatingSortingEnum,$language:String,$occasion:RatingOccasionEnum,$keywordUuid:ID){restaurant(restaurantId:$restaurantId){id seoId slug name aggregateRatings{thefork{reviewCount ratingValue}}}ratingSummary(restaurantId:$restaurantId){reviewCount ratingCount languageStats}restaurantRatingsList(restaurantId:$restaurantId,pagination:$pagination,orderBy:$orderBy,withReview:$withReview,sortDirection:$sortDirection,language:$language,occasion:$occasion,keywordUuid:$keywordUuid){ratings{id uuid ratingValue mealDate review{reviewBody}reviewer{id avatarUrl firstName lastName reviewCount email createdAt}restaurantReply{body status}photos{id alt thumbnailUrl:previewUrl photoUrl:imageUrl likedByCustomer likes}likes keywordsPosition{start end}}pagination{hasNext}}}`;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  // Input event listener
  inputEl.addEventListener('input', handleInput);
  
  // Controls
  loadSampleBtn.addEventListener('click', loadSample);
  clearBtn.addEventListener('click', clearAll);
  
  // Modes
  modeBeautify.addEventListener('click', () => setMode('beautify'));
  modeMinify.addEventListener('click', () => setMode('minify'));
  
  // Copy Actions
  copyQueryBtn.addEventListener('click', copyQuery);
  copyJsonBtn.addEventListener('click', copyJson);
  copyCurlBtn.addEventListener('click', copyCurl);

  // Tab Navigation Actions
  navFormatter.addEventListener('click', () => switchTab('formatter'));
  navPlayground.addEventListener('click', () => switchTab('playground'));

  // Run Query Action
  runQueryBtn.addEventListener('click', executeQuery);

  // Focus input on load
  inputEl.focus();
});

// Set Mode (Beautify or Minify)
function setMode(mode) {
  if (activeMode === mode) return;
  activeMode = mode;
  
  if (mode === 'beautify') {
    modeBeautify.classList.add('active');
    modeMinify.classList.remove('active');
  } else {
    modeMinify.classList.add('active');
    modeBeautify.classList.remove('active');
  }
  
  processQuery();
}

// Pre-process raw user input to unescape string-encoded newlines, tabs, and quotes (common in logs/network payloads)
function preprocessQuery(rawInput) {
  let cleaned = rawInput.trim();
  
  // Scenario 1: It's a JSON object containing a "query" field (e.g. {"query": "..."})
  if (cleaned.startsWith('{') && cleaned.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (parsed && typeof parsed.query === 'string') {
        return parsed.query;
      }
    } catch (e) {
      // Not valid JSON, ignore and continue
    }
  }

  // Scenario 2: It's a JSON string (starts and ends with double quotes)
  if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
    try {
      const parsed = JSON.parse(cleaned);
      if (typeof parsed === 'string') {
        return parsed;
      }
    } catch (e) {
      // Failed to parse as JSON string, continue
    }
  }

  // Scenario 3: Clean up escaped sequences manually
  // Replace literal '\n' (backslash + n) with actual newlines
  cleaned = cleaned.replace(/\\n/g, '\n');
  // Replace literal '\t' (backslash + t) with actual spaces
  cleaned = cleaned.replace(/\\t/g, '  ');
  // Replace escaped double quotes '\"' with '"'
  cleaned = cleaned.replace(/\\"/g, '"');
  
  return cleaned;
}

// Process, Format & Validate Query
function processQuery() {
  const rawQuery = inputEl.value;
  charCountEl.textContent = `${rawQuery.length} characters`;

  if (!rawQuery.trim()) {
    outputEl.textContent = '# Output will appear here...';
    outputEl.className = 'language-graphql';
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(outputEl);
    }
    updateStatus('info', '💡 Enter or paste a GraphQL query to format.');
    currentOutput = '';
    return;
  }

  try {
    let result = '';
    const query = preprocessQuery(rawQuery);

    // Step 1: Parse to AST (Validates syntax)
    const ast = parse(query);
    
    // Step 2: Format or Minify
    if (activeMode === 'beautify') {
      result = formatQueryParentheses(print(ast));
    } else {
      result = minifyGraphQL(query);
    }
    
    updateStatus('success', '✨ Valid GraphQL query.');

    currentOutput = result;
    outputEl.textContent = result;
    outputEl.className = 'language-graphql';
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(outputEl);
    }
  } catch (error) {
    // Show validation error
    updateStatus('error', `❌ Syntax Error: ${error.message}`);
    
    // Display error message in output panel as a comment
    outputEl.textContent = `# Syntax Error:\n# ${error.message.replace(/\n/g, '\n# ')}`;
    outputEl.className = 'language-text';
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(outputEl);
    }
    currentOutput = '';
  }
}

// Debounce timer
let debounceTimer;
function handleInput() {
  clearTimeout(debounceTimer);
  
  const rawInput = inputEl.value;
  const parsedHttp = parseRawHttpRequest(rawInput);
  
  if (parsedHttp) {
    // Populate Formatter input with extracted query
    inputEl.value = parsedHttp.query;
    
    // Populate Playground config fields
    endpointInput.value = parsedHttp.endpoint;
    headersInput.value = JSON.stringify(parsedHttp.headers, null, 2);
    variablesInput.value = JSON.stringify(parsedHttp.variables, null, 2);
    
    showToast("HTTP Request header & payload parsed successfully!");
  }
  
  debounceTimer = setTimeout(processQuery, 250);
}

// Update Status Bar UI
function updateStatus(type, message) {
  statusBar.className = `status-bar ${type}`;
  let icon = '💡';
  if (type === 'success') icon = '✨';
  if (type === 'error') icon = '❌';
  
  statusBar.querySelector('.status-icon').textContent = icon;
  statusMessage.textContent = message;
}

// Escape query for JSON payloads (convert actual newlines to literal \n and escape double quotes)
function minifyGraphQL(query) {
  try {
    const ast = parse(preprocessQuery(query));
    const formatted = formatQueryParentheses(print(ast));
    return formatted.replace(/\r?\n/g, '\\n').replace(/"/g, '\\"');
  } catch (e) {
    // Fallback if parsing fails
    const formatted = formatQueryParentheses(fallbackFormat(query));
    return formatted.replace(/\r?\n/g, '\\n').replace(/"/g, '\\"');
  }
}

// Basic Offline/Fallback Formatter
function fallbackFormat(query) {
  let clean = query.replace(/\s+/g, ' ');
  clean = clean.replace(/\{/g, ' {\n');
  clean = clean.replace(/\}/g, '\n}\n');
  clean = clean.replace(/,/g, ', ');
  
  const lines = clean.split('\n');
  let indentLevel = 0;
  const formatted = [];
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    if (line.startsWith('}')) {
      indentLevel = Math.max(0, indentLevel - 1);
    }
    
    formatted.push('  '.repeat(indentLevel) + line);
    
    if (line.endsWith('{')) {
      indentLevel++;
    }
  }
  
  return formatted.join('\n').replace(/\n\s*\n/g, '\n');
}

// Split string by commas, but only at the top level (ignores commas inside brackets/braces)
function splitTopLevelCommas(str) {
  const parts = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === '(' || char === '[' || char === '{') {
      depth++;
      current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

// Post-process the printed query to format parenthesis lists with multiple arguments onto new lines
function formatQueryParentheses(printedQuery) {
  const lines = printedQuery.split('\n');
  const resultLines = [];

  for (let line of lines) {
    const openParenIdx = line.indexOf('(');
    const closeParenIdx = line.lastIndexOf(')');

    if (openParenIdx !== -1 && closeParenIdx !== -1 && openParenIdx < closeParenIdx) {
      const prefix = line.substring(0, openParenIdx);
      const inside = line.substring(openParenIdx + 1, closeParenIdx);
      const suffix = line.substring(closeParenIdx + 1);

      const items = splitTopLevelCommas(inside);

      if (items.length > 1) {
        const currentIndent = prefix.match(/^\s*/)[0];
        const childIndent = currentIndent + '  ';
        const formattedItems = items
          .map(item => {
            let cleaned = item.trim();
            // Remove trailing commas if they were printed by graphql
            if (cleaned.endsWith(',')) {
              cleaned = cleaned.slice(0, -1);
            }
            return `${childIndent}${cleaned}`;
          })
          .join('\n');

        resultLines.push(`${prefix}(\n${formattedItems}\n${currentIndent})${suffix}`);
      } else {
        // If only 1 argument, keep it on a single line, but strip any trailing comma
        const cleanedItem = inside.trim().replace(/,$/, '');
        resultLines.push(`${prefix}(${cleanedItem})${suffix}`);
      }
    } else {
      resultLines.push(line);
    }
  }

  return resultLines.join('\n');
}

// Load Sample Query
function loadSample() {
  inputEl.value = sampleQuery;
  processQuery();
  showToast('Sample query loaded!');
}

// Clear input and output
function clearAll() {
  inputEl.value = '';
  processQuery();
  inputEl.focus();
}

// Copy to Clipboard Helpers
function copyToClipboard(text, successMessage) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMessage);
  }).catch(err => {
    console.error('Failed to copy text: ', err);
    showToast('Failed to copy to clipboard.');
  });
}

function copyQuery() {
  if (!currentOutput) return;
  copyToClipboard(currentOutput, 'Query copied!');
}

function copyJson() {
  if (!currentOutput) return;
  const jsonPayload = JSON.stringify({ query: currentOutput }, null, 2);
  copyToClipboard(jsonPayload, 'Query copied as JSON payload!');
}

function copyCurl() {
  if (!currentOutput) return;
  const jsonPayload = JSON.stringify({ query: currentOutput });
  // Escape single quotes for bash compatibility
  const escapedPayload = jsonPayload.replace(/'/g, "'\\''");
  const curlCmd = `curl -X POST https://api.example.com/graphql \\\n  -H "Content-Type: application/json" \\\n  -d '${escapedPayload}'`;
  copyToClipboard(curlCmd, 'curl command copied!');
}

// Show Toast
function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.remove('hidden');
  
  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2000);
}

// Switch between Formatter and Playground tabs
function switchTab(tabId) {
  if (tabId === 'formatter') {
    navFormatter.classList.add('active');
    navPlayground.classList.remove('active');
    formatterView.classList.add('active');
    playgroundView.classList.remove('active');
  } else {
    navFormatter.classList.remove('active');
    navPlayground.classList.add('active');
    formatterView.classList.remove('active');
    playgroundView.classList.add('active');
    
    // Auto sync variables from formatted query to variables input when switching
    syncQueryVariables();
  }
}

// Automatically extract variable definitions from current query and build a JSON template
function syncQueryVariables() {
  const currentQuery = currentOutput || inputEl.value;
  if (!currentQuery.trim()) return;

  try {
    const ast = parse(preprocessQuery(currentQuery));
    const opDefinition = ast.definitions.find(def => def.kind === 'OperationDefinition');
    
    if (opDefinition && opDefinition.variableDefinitions && opDefinition.variableDefinitions.length > 0) {
      // Check if variablesInput is empty or just standard default, then overwrite
      const currentVarsValue = variablesInput.value.trim();
      if (!currentVarsValue || currentVarsValue === '{}' || currentVarsValue.startsWith('{\n  "restaurantId"')) {
        const varsObj = {};
        opDefinition.variableDefinitions.forEach(varDef => {
          const varName = varDef.variable.name.value;
          // Pre-populate restaurantId with sample if it matches, otherwise empty string
          if (varName === 'restaurantId') {
            varsObj[varName] = 'restaurant-id-placeholder'; // default indicator
          } else {
            varsObj[varName] = '';
          }
        });
        variablesInput.value = JSON.stringify(varsObj, null, 2);
      }
    }
  } catch (err) {
    console.warn("Could not auto-extract variables from query due to syntax error:", err.message);
  }
}

// Execute the GraphQL query against the configured API endpoint
function executeQuery() {
  const endpoint = endpointInput.value.trim();
  const queryText = currentOutput || inputEl.value;

  if (!endpoint) {
    showToast("Please enter a valid Endpoint URL!");
    return;
  }
  if (!queryText.trim()) {
    showToast("Please enter a GraphQL query first!");
    return;
  }

  // Parse variables and headers
  let variablesObj = {};
  let headersObj = {
    'Content-Type': 'application/json'
  };

  try {
    const varsText = variablesInput.value.trim();
    if (varsText) {
      variablesObj = JSON.parse(varsText);
    }
  } catch (e) {
    showToast("Syntax Error in Query Variables JSON!");
    return;
  }

  try {
    const headersText = headersInput.value.trim();
    if (headersText) {
      headersObj = { ...headersObj, ...JSON.parse(headersText) };
    }
  } catch (e) {
    showToast("Syntax Error in HTTP Headers JSON!");
    return;
  }

  // Display loading state
  playgroundResponse.textContent = JSON.stringify({ message: "Sending request to " + endpoint + "..." }, null, 2);
  playgroundResponse.className = 'language-json';
  if (typeof Prism !== 'undefined') {
    Prism.highlightElement(playgroundResponse);
  }

  // Extract operationName from AST if present
  let operationName = null;
  try {
    const ast = parse(preprocessQuery(queryText));
    const opDef = ast.definitions.find(d => d.kind === 'OperationDefinition');
    if (opDef && opDef.name) {
      operationName = opDef.name.value;
    }
  } catch (e) {
    console.warn("Could not extract operationName:", e.message);
  }

  const payload = {
    query: preprocessQuery(queryText),
    variables: variablesObj
  };
  if (operationName) {
    payload.operationName = operationName;
  }

  const finalBody = isBatchRequest ? [payload] : payload;

  // Send the POST request
  fetch(endpoint, {
    method: 'POST',
    headers: headersObj,
    body: JSON.stringify(finalBody)
  })
  .then(res => {
    // If not successful status, return text to show raw error
    if (!res.ok) {
      return res.text().then(text => {
        throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
      });
    }
    return res.json();
  })
  .then(data => {
    playgroundResponse.textContent = JSON.stringify(data, null, 2);
    playgroundResponse.className = 'language-json';
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(playgroundResponse);
    }
  })
  .catch(err => {
    playgroundResponse.textContent = JSON.stringify({
      error: err.message,
      possible_causes: [
        "1. CORS Block: The API does not accept requests from localhost/file origins.",
        "2. Authentication: The API requires cookies or custom headers that are missing.",
        "3. Network: You are offline or the API endpoint is unreachable."
      ],
      solutions: [
        "👉 Bypassing CORS: Install a Chrome extension like 'Allow CORS' and turn it on.",
        "👉 Native Terminal (No CORS): Click the 'Copy curl' button on the Formatter tab and run the query in your terminal."
      ]
    }, null, 2);
    playgroundResponse.className = 'language-json';
    if (typeof Prism !== 'undefined') {
      Prism.highlightElement(playgroundResponse);
    }
  });
}

// Parse a raw HTTP request dump (extracting Endpoint, Headers, Variables, and Query)
function parseRawHttpRequest(text) {
  if (!text) return null;
  const trimmed = text.trim();
  const lines = trimmed.split(/\r?\n/);
  
  if (lines.length === 0) return null;

  // Verify if the first line is an HTTP Request Line (e.g. POST /api/graphql HTTP/2)
  const requestLine = lines[0].trim();
  const requestLineMatch = requestLine.match(/^(POST|GET|PUT|PATCH|DELETE)\s+(\/\S*)\s+HTTP\/\d(?:\.\d)?$/i);
  if (!requestLineMatch) {
    return null; // Not a raw HTTP request dump
  }

  const method = requestLineMatch[1].toUpperCase();
  const path = requestLineMatch[2];
  
  const headers = {};
  let bodyStartIndex = -1;
  
  // Parse headers line by line
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '') {
      // Empty line indicates end of headers and start of body
      bodyStartIndex = i + 1;
      break;
    }
    
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.substring(0, colonIdx).trim();
      const val = line.substring(colonIdx + 1).trim();
      headers[key] = val;
    }
  }

  // Determine endpoint URL
  const host = headers['Host'] || headers['host'] || '';
  const endpoint = host ? `https://${host}${path}` : path;
  
  // Extract body content
  let bodyText = '';
  if (bodyStartIndex !== -1 && bodyStartIndex < lines.length) {
    bodyText = lines.slice(bodyStartIndex).join('\n').trim();
  }

  let query = '';
  let variables = {};

  if (bodyText) {
    try {
      let payload = JSON.parse(bodyText);
      // Check if it's an array (like Apollo query batching)
      if (Array.isArray(payload)) {
        isBatchRequest = true;
        payload = payload[0];
      } else {
        isBatchRequest = false;
      }
      
      if (payload) {
        if (typeof payload.query === 'string') {
          query = payload.query;
        }
        if (payload.variables) {
          variables = payload.variables;
        }
      }
    } catch (e) {
      console.warn("Failed to parse request body as JSON:", e);
      isBatchRequest = false;
    }
  }

  return {
    endpoint,
    headers,
    query,
    variables
  };
}
