interface LanguageStats {
  [language: string]: number;
}

interface Repository {
  name: string;
  languages_url: string;
  private: boolean;
  fork: boolean;
}

interface GitHubLanguages {
  [language: string]: number;
}

async function fetchMostUsedLanguages(username: string, token?: string): Promise<LanguageStats> {
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'gh-stats-app'
  };

  if (token) {
    headers['Authorization'] = `token ${token}`;
  }

  try {
    // Fetch all repositories
    const reposResponse = await fetch(`https://api.github.com/users/${username}/repos?per_page=100`, {
      headers
    });

    if (!reposResponse.ok) {
      throw new Error(`Failed to fetch repositories: ${reposResponse.status} ${reposResponse.statusText}`);
    }

    const repos = await reposResponse.json() as Repository[];
    const languageStats: LanguageStats = {};

    // Filter out forked repositories
    const originalRepos = repos.filter(repo => !repo.fork);

    console.log(`📈 Found ${repos.length} total repos, ${originalRepos.length} original repos (excluding forks)`);

    // Fetch language data for each original repository
    const languagePromises = originalRepos.map(async (repo) => {
      try {
        const langResponse = await fetch(repo.languages_url, { headers });
        if (langResponse.ok) {
          const languages = await langResponse.json() as GitHubLanguages;
          return languages;
        }
      } catch (error) {
        console.warn(`Failed to fetch languages for ${repo.name}:`, error);
      }
      return {} as GitHubLanguages;
    });

    const allLanguages = await Promise.all(languagePromises);

    // Aggregate language statistics
    allLanguages.forEach(languages => {
      Object.entries(languages).forEach(([language, bytes]) => {
        languageStats[language] = (languageStats[language] || 0) + bytes;
      });
    });

    return languageStats;
  } catch (error) {
    console.error('Error fetching GitHub data:', error);
    throw error;
  }
}

function displayLanguageChart(stats: LanguageStats) {
  const sortedLanguages = Object.entries(stats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 languages

  if (sortedLanguages.length === 0) {
    console.log('\n📊 No languages found to display chart.');
    return;
  }

  const total = Object.values(stats).reduce((sum, bytes) => sum + bytes, 0);
  const maxNameLength = Math.max(...sortedLanguages.map(([name]) => name.length));
  const chartWidth = 64; // Width of the chart bar

  // Get the maximum percentage to scale against
  const maxPercentage = (sortedLanguages[0]![1] / total) * 100;

  console.log('\n📊 Language Distribution Chart:\n');

  sortedLanguages.forEach(([language, bytes]) => {
    const percentage = (bytes / total) * 100;
    // Scale bar length relative to the maximum percentage, not 100%
    const barLength = Math.round((percentage / maxPercentage) * chartWidth);
    const emptyLength = chartWidth - barLength;

    const bar = '='.repeat(barLength) + ' '.repeat(emptyLength);
    const paddedName = language.padEnd(maxNameLength);
    const formattedPercentage = percentage.toFixed(2).padStart(6);

    console.log(`${paddedName} [${bar}] ${formattedPercentage}%`);
  });
}

function displayLanguageStats(stats: LanguageStats) {
  const sortedLanguages = Object.entries(stats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10); // Top 10 languages

  const total = Object.values(stats).reduce((sum, bytes) => sum + bytes, 0);
  const totalLanguages = Object.keys(stats).length;

  console.log('\n🚀 Your Most Used Languages on GitHub:\n');
  console.log(`Found ${totalLanguages} total languages. Showing top 10:\n`);
  console.log('Rank | Language      | Bytes      | Percentage');
  console.log('-----|---------------|------------|----------');

  sortedLanguages.forEach(([language, bytes], index) => {
    const percentage = ((bytes / total) * 100).toFixed(1);
    const rank = (index + 1).toString().padStart(2);
    const langName = language.padEnd(13);
    const bytesStr = bytes.toLocaleString().padStart(10);

    console.log(`${rank}   | ${langName} | ${bytesStr} | ${percentage.padStart(6)}%`);
  });

  // Calculate and display sum of displayed percentages
  const displayedPercentageSum = sortedLanguages.reduce((sum, [, bytes]) => {
    return sum + ((bytes / total) * 100);
  }, 0);

  const remainingPercentage = 100 - displayedPercentageSum;

  console.log('-----|---------------|------------|----------');
  console.log(`     | TOTAL SHOWN   |            | ${displayedPercentageSum.toFixed(1).padStart(6)}%`);

  if (totalLanguages > 10) {
    console.log(`     | OTHER (${(totalLanguages - 10).toString().padStart(2)})    |            | ${remainingPercentage.toFixed(1).padStart(6)}%`);
  }

  // Display the chart
  displayLanguageChart(stats);

  console.log('\n💡 Tip: Set GITHUB_TOKEN environment variable for higher rate limits');
}

// Main execution
async function main() {
  const username = process.env.GITHUB_USERNAME || 'your-username-here';
  const token = process.env.GITHUB_TOKEN;

  if (username === 'your-username-here') {
    console.log('❌ Please set your GitHub username:');
    console.log('export GITHUB_USERNAME="your-actual-username"');
    console.log('\nOptionally set a token for higher rate limits:');
    console.log('export GITHUB_TOKEN="your-github-token"');
    process.exit(1);
  }

  try {
    console.log(`📊 Fetching language statistics for: ${username}`);
    const stats = await fetchMostUsedLanguages(username, token);
    displayLanguageStats(stats);
  } catch (error) {
    console.error('❌ Failed to fetch language statistics:', error);
    process.exit(1);
  }
}

main();
