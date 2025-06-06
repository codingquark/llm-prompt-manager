const fetch = require('node-fetch');
require('dotenv').config();

async function testHybridSearch() {
  console.log('Testing hybrid search implementation...\n');
  
  const baseUrl = 'http://localhost:5001/api';
  
  try {
    // Test 1: Generate embeddings for all prompts first
    console.log('1. Generating embeddings for all prompts...');
    const embedResponse = await fetch(`${baseUrl}/embeddings/generate-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (embedResponse.ok) {
      const embedResult = await embedResponse.json();
      console.log(`✅ Embeddings generated: ${embedResult.successful} successful, ${embedResult.failed} failed\n`);
    } else {
      console.log('❌ Failed to generate embeddings');
      return;
    }
    
    // Test 2: Test FTS search
    console.log('2. Testing FTS search for "soc"...');
    const ftsResponse = await fetch(`${baseUrl}/search/fts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'soc', limit: 5 })
    });
    
    if (ftsResponse.ok) {
      const ftsResults = await ftsResponse.json();
      console.log(`✅ FTS found ${ftsResults.length} results:`);
      ftsResults.forEach(r => console.log(`   - ${r.title} (rank: ${r.search_rank?.toFixed(2)})`));
      console.log();
    }
    
    // Test 3: Test semantic search
    console.log('3. Testing semantic search for "thinking approach"...');
    const semanticResponse = await fetch(`${baseUrl}/search/semantic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'thinking approach', limit: 5 })
    });
    
    if (semanticResponse.ok) {
      const semanticResults = await semanticResponse.json();
      console.log(`✅ Semantic found ${semanticResults.length} results:`);
      semanticResults.forEach(r => console.log(`   - ${r.title} (similarity: ${r.similarity?.toFixed(3)})`));
      console.log();
    }
    
    // Test 4: Test hybrid search
    console.log('4. Testing hybrid search for "socratic"...');
    const hybridResponse = await fetch(`${baseUrl}/search/hybrid`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'socratic', limit: 5 })
    });
    
    if (hybridResponse.ok) {
      const hybridResults = await hybridResponse.json();
      console.log(`✅ Hybrid found ${hybridResults.length} results:`);
      hybridResults.forEach(r => {
        console.log(`   - ${r.title}`);
        console.log(`     Type: ${r.search_type}, Hybrid: ${r.scores?.hybrid?.toFixed(3)}, FTS: ${r.scores?.fts?.toFixed(3)}, Semantic: ${r.scores?.semantic?.toFixed(3)}`);
      });
      console.log();
    }
    
    // Test 5: Test regular GET search (should now use hybrid)
    console.log('5. Testing regular search endpoint for "soc"...');
    const regularResponse = await fetch(`${baseUrl}/prompts?search=soc`);
    
    if (regularResponse.ok) {
      const regularResults = await regularResponse.json();
      console.log(`✅ Regular search found ${regularResults.length} results:`);
      regularResults.forEach(r => {
        console.log(`   - ${r.title}`);
        if (r.scores) {
          console.log(`     Type: ${r.search_type}, Hybrid: ${r.scores.hybrid?.toFixed(3)}`);
        }
      });
    }
    
    console.log('\n🎉 Hybrid search testing complete!');
    
  } catch (error) {
    console.error('❌ Error testing hybrid search:', error.message);
  }
}

testHybridSearch();