#!/usr/bin/env node

/**
 * Agentic Literature Survey CLI Runner
 * Executes the complete multi-agent literature survey pipeline directly from terminal.
 *
 * Usage:
 *   node runner/cli.js "EEG Seizure Prediction using Deep Learning"
 *   npm run survey -- "Graph Neural Networks for Drug Discovery"
 */

const fs = require('fs');
const path = require('path');
const { refineQuery, analyzePaper, synthesizeReview } = require('./src/agents');
const { performFederatedSearch } = require('./src/search');
const { aggregateAndDeduplicate } = require('./src/dedupe');
const { generateHTMLReport } = require('./src/html_report');

// Load environment variables if .env file exists
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const [key, ...vals] = trimmed.split('=');
    if (key && !process.env[key.trim()]) {
      process.env[key.trim()] = vals.join('=').trim().replace(/(^["']|["']$)/g, '');
    }
  });
}

async function runSurveyPipeline(topic) {
  console.log('\n=============================================================');
  console.log('   AGENTIC LITERATURE SURVEY WORKFLOW - PRODUCTION PIPELINE');
  console.log('=============================================================');
  console.log(`Topic: "${topic}"`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  const startTime = Date.now();

  // Stage 1: Query Refiner Agent
  console.log('Step 1/5: Running Query Refiner Agent...');
  const refined = await refineQuery(topic, process.env);
  console.log(`  -> Main Topic: ${refined.main_topic}`);
  console.log(`  -> Refined Search Queries: ${refined.refined_queries?.length || 0} queries generated`);

  // Stage 2: Parallel Federated Search
  console.log('\nStep 2/5: Fetching academic publications in parallel...');
  const searchResults = await performFederatedSearch({
    topic,
    refinedQueries: refined.refined_queries
  });

  // Stage 3: Normalization & Deduplication
  console.log('\nStep 3/5: Deduplicating and ranking publications...');
  const deduplicatedPapers = aggregateAndDeduplicate(searchResults);
  console.log(`  -> Total unique papers after deduplication: ${deduplicatedPapers.length}`);

  // Stage 4: Paper Analysis (Top Papers — deep AI analysis on top 25)
  console.log('\nStep 4/5: Analyzing individual papers with Paper Analyzer Agent...');
  const papersToAnalyze = deduplicatedPapers.slice(0, 25);
  for (let i = 0; i < papersToAnalyze.length; i++) {
    const p = papersToAnalyze[i];
    process.stdout.write(`  [${i + 1}/${papersToAnalyze.length}] Analyzing: "${p.title.substring(0, 50)}..."\r`);
    p.analysis = await analyzePaper(p, process.env);
  }
  console.log('\n  -> Paper analysis complete.');

  // Stage 5: Synthesis & Literature Matrix
  console.log('\nStep 5/5: Synthesizing Review & Generating IEEE-Style Report...');
  const review = await synthesizeReview({
    topic,
    papers: papersToAnalyze,
    keywords: refined.keywords
  }, process.env);

  // Generate HTML Report
  const htmlContent = generateHTMLReport({
    topic,
    review,
    papers: papersToAnalyze,
    allPapers: deduplicatedPapers,
    keywords: refined.keywords,
    reportMeta: { institution: 'SQI College of ICT · Caleb University, Imota, Lagos' }
  });

  // Save Outputs
  const outputDir = path.resolve(process.cwd(), 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const safeTopic = topic.toLowerCase().replace(/[^a-z0-9]+/g, '_').substring(0, 30);
  const timestamp = Date.now();
  const htmlFileName = `survey_${safeTopic}_${timestamp}.html`;
  const jsonFileName = `matrix_${safeTopic}_${timestamp}.json`;

  const htmlPath = path.join(outputDir, htmlFileName);
  const jsonPath = path.join(outputDir, jsonFileName);

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  fs.writeFileSync(jsonPath, JSON.stringify({
    topic,
    generated_at: new Date().toISOString(),
    total_papers_analyzed: papersToAnalyze.length,
    review,
    papers: papersToAnalyze
  }, null, 2), 'utf8');

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n=============================================================');
  console.log('   SURVEY GENERATION COMPLETE!');
  console.log('=============================================================');
  console.log(`Execution Time: ${durationSec}s`);
  console.log(`Total Papers Processed: ${papersToAnalyze.length}`);
  console.log(`HTML Report saved to:   ${htmlPath}`);
  console.log(`Survey Matrix saved to: ${jsonPath}`);
  console.log('=============================================================\n');

  return { htmlPath, jsonPath, htmlContent };
}

// CLI Execution entrypoint
const topicArg = process.argv.slice(2).join(' ').trim();
if (!topicArg) {
  console.log('Usage: node runner/cli.js "<Research Topic>"');
  console.log('Example: node runner/cli.js "EEG Seizure Prediction using Deep Learning"');
  process.exit(1);
}

runSurveyPipeline(topicArg).catch(err => {
  console.error('\nFatal Pipeline Error:', err);
  process.exit(1);
});
