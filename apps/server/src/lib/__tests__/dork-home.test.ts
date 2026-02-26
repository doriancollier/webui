import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import { resolveDorkHome } from '../dork-home.js';

describe('resolveDorkHome', () => {
  let savedDorkHome: string | undefined;
  let savedNodeEnv: string | undefined;

  beforeEach(() => {
    savedDorkHome = process.env.DORK_HOME;
    savedNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    if (savedDorkHome === undefined) {
      delete process.env.DORK_HOME;
    } else {
      process.env.DORK_HOME = savedDorkHome;
    }
    if (savedNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = savedNodeEnv;
    }
  });

  it('returns DORK_HOME env var when set, regardless of NODE_ENV', () => {
    process.env.DORK_HOME = '/custom/dork/home';
    process.env.NODE_ENV = 'development';
    expect(resolveDorkHome()).toBe('/custom/dork/home');
  });

  it('returns project-local .temp/.dork in development', () => {
    delete process.env.DORK_HOME;
    process.env.NODE_ENV = 'development';
    expect(resolveDorkHome()).toBe(path.join(process.cwd(), '.temp', '.dork'));
  });

  it('returns project-local .temp/.dork when NODE_ENV is unset', () => {
    delete process.env.DORK_HOME;
    delete process.env.NODE_ENV;
    expect(resolveDorkHome()).toBe(path.join(process.cwd(), '.temp', '.dork'));
  });

  it('returns ~/.dork in production', () => {
    delete process.env.DORK_HOME;
    process.env.NODE_ENV = 'production';
    expect(resolveDorkHome()).toBe(path.join(os.homedir(), '.dork'));
  });

  it('DORK_HOME override wins over production default', () => {
    process.env.DORK_HOME = '/override/path';
    process.env.NODE_ENV = 'production';
    expect(resolveDorkHome()).toBe('/override/path');
  });
});
