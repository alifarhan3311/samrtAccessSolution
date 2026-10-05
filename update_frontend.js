const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.jsx') || f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  
  // Replace Authorization header in generic fetch calls
  content = content.replace(/Authorization:\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`/g, '');
  content = content.replace(/'Authorization':\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`/g, '');
  content = content.replace(/"Authorization":\s*`Bearer \$\{localStorage\.getItem\('token'\)\}`/g, '');
  
  // Clean up commas/empty headers
  content = content.replace(/,\s*}/g, ' }');
  content = content.replace(/{\s*,/g, '{ ');
  
  // Add credentials: 'include' to fetch calls where options are passed
  content = content.replace(/fetch\(([^,]+),\s*{/g, "fetch($1, { credentials: 'include',");
  
  // In main.jsx, remove token saving/removing
  if (file === 'main.jsx') {
    content = content.replace(/localStorage\.setItem\('token',\s*d\.token\);/g, '');
    content = content.replace(/localStorage\.removeItem\('token'\);\s*/g, '');
    // In request function
    content = content.replace(/const token\s*=\s*localStorage\.getItem\('token'\);/g, '');
    content = content.replace(/\.\.\.\(token\s*\?\s*{\s*Authorization:\s*`Bearer \$\{token\}`\s*}\s*:\s*{}\),/g, '');
  }

  fs.writeFileSync(filePath, content);
}

console.log('Frontend updated to use httpOnly cookies.');
