require('dotenv').config();
const { pool } = require('./index');

// Sample proverbs data (without vectors - those would be generated via embedding API)
const sampleProverbs = [
  { chapter: 1, verse: 1, text: "The proverbs of Solomon the son of David, king of Israel;" },
  { chapter: 1, verse: 2, text: "To know wisdom and instruction; to perceive the words of understanding;" },
  { chapter: 1, verse: 3, text: "To receive the instruction of wisdom, justice, and judgment, and equity;" },
  { chapter: 1, verse: 7, text: "The fear of the LORD is the beginning of knowledge: but fools despise wisdom and instruction." },
  { chapter: 3, verse: 5, text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { chapter: 3, verse: 6, text: "In all thy ways acknowledge him, and he shall direct thy paths." },
  { chapter: 4, verse: 7, text: "Wisdom is the principal thing; therefore get wisdom: and with all thy getting get understanding." },
  { chapter: 16, verse: 18, text: "Pride goeth before destruction, and an haughty spirit before a fall." },
  { chapter: 22, verse: 6, text: "Train up a child in the way he should go: and when he is old, he will not depart from it." },
  { chapter: 27, verse: 17, text: "Iron sharpeneth iron; so a man sharpeneth the countenance of his friend." }
];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Insert sample proverbs
    for (const proverb of sampleProverbs) {
      await client.query(
        `INSERT INTO proverbs (chapter, verse, text)
         VALUES ($1, $2, $3)
         ON CONFLICT (chapter, verse) DO UPDATE SET text = $3`,
        [proverb.chapter, proverb.verse, proverb.text]
      );
    }

    await client.query('COMMIT');
    console.log('Seed completed successfully');
    console.log(`Inserted ${sampleProverbs.length} sample proverbs`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
