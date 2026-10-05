fetch('http://localhost:5321/api/terminals?limit=500')
  .then(res => res.json())
  .then(data => {
    const terms = data.items.filter(t => t.terminalId === 'DMH00020' || t.terminalId === 'DMH0003');
    for (const t of terms) {
      console.log(t.terminalId);
      console.log('official.address:', JSON.stringify(t.official?.address));
      console.log('current.address:', JSON.stringify(t.current?.address));
    }
  })
  .catch(console.error);
