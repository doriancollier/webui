import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

interface TestEntry {
  specFile: string;
  feature: string;
  description: string;
  lastRun: string;
  lastStatus: string;
  runCount: number;
  passCount: number;
  failCount: number;
  relatedCode: string[];
  lastModified: string;
}

interface Manifest {
  version: number;
  tests: Record<string, TestEntry>;
  runHistory: Array<{
    id: string;
    timestamp: string;
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  }>;
}

class ManifestReporter implements Reporter {
  private manifestPath: string;
  private manifest: Manifest;
  private runResults: { title: string; status: string; file: string; duration: number }[] = [];
  private startTime = Date.now();

  constructor() {
    this.manifestPath = path.resolve(import.meta.dirname, '..', 'manifest.json');
    this.manifest = this.loadManifest();
  }

  private loadManifest(): Manifest {
    try {
      return JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
    } catch {
      return { version: 1, tests: {}, runHistory: [] };
    }
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const testsDir = path.resolve(import.meta.dirname, '..', 'tests');
    const relativeFile = path.relative(testsDir, test.location.file);
    const feature = relativeFile.split(path.sep)[0] || 'unknown';
    const testKey = path.basename(test.location.file, '.spec.ts');

    const existing = this.manifest.tests[testKey] || {
      specFile: `tests/${relativeFile}`,
      feature,
      description: test.title,
      lastRun: '',
      lastStatus: '',
      runCount: 0,
      passCount: 0,
      failCount: 0,
      relatedCode: [],
      lastModified: '',
    };

    existing.lastRun = new Date().toISOString();
    existing.lastStatus = result.status;
    existing.runCount++;
    if (result.status === 'passed') existing.passCount++;
    if (result.status === 'failed') existing.failCount++;
    this.manifest.tests[testKey] = existing;

    this.runResults.push({
      title: test.title,
      status: result.status,
      file: relativeFile,
      duration: result.duration,
    });
  }

  onEnd(_result: FullResult) {
    const now = new Date();
    const runId = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    this.manifest.runHistory.push({
      id: runId,
      timestamp: now.toISOString(),
      total: this.runResults.length,
      passed: this.runResults.filter((r) => r.status === 'passed').length,
      failed: this.runResults.filter((r) => r.status === 'failed').length,
      skipped: this.runResults.filter((r) => r.status === 'skipped').length,
      duration: Date.now() - this.startTime,
    });
    if (this.manifest.runHistory.length > 100) {
      this.manifest.runHistory = this.manifest.runHistory.slice(-100);
    }

    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }
}

export default ManifestReporter;
