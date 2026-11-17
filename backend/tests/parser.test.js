const { extractText } = require('../utils/parser');

const file = (originalname, text = '') => ({
  originalname,
  buffer: Buffer.from(text),
});

describe('extractText: file type handling', () => {
  test('rejects other extensions by returning empty text, without throwing', async () => {
    expect(await extractText(file('resume.txt', 'hello'))).toBe('');
  });

  test('extension check is case-insensitive for .PDF names', async () => {
    // A non-PDF buffer under a .PDF name should reach the PDF parser and throw,
    // which proves the name was matched case-insensitively.
    await expect(extractText(file('RESUME.PDF', 'not a pdf'))).rejects.toThrow();
  });

  test('a .docx name with bytes that are not a real docx throws', async () => {
    await expect(extractText(file('resume.docx', 'not a docx'))).rejects.toThrow();
  });
});

describe('extractText: normalization with mocked mammoth', () => {
  let extractWithMock;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('mammoth', () => ({
      extractRawText: jest.fn(),
    }));
    extractWithMock = require('../utils/parser').extractText;
  });

  afterEach(() => {
    jest.dontMock('mammoth');
  });

  const setRaw = (value) => {
    require('mammoth').extractRawText.mockResolvedValue({ value });
  };

  test('removes carriage returns', async () => {
    setRaw('Line one\r\nLine two\r\n');
    expect(await extractWithMock(file('a.docx'))).toBe('Line one\nLine two');
  });

  test('collapses runs of spaces and tabs into one space', async () => {
    setRaw('Built    a\tAPI');
    expect(await extractWithMock(file('a.docx'))).toBe('Built a API');
  });

  test('keeps single line breaks (needed for bullet detection)', async () => {
    setRaw('• Built X\n• Led Y');
    expect(await extractWithMock(file('a.docx'))).toBe('• Built X\n• Led Y');
  });

  test('reduces three or more newlines to a blank line', async () => {
    setRaw('Top\n\n\n\nBottom');
    expect(await extractWithMock(file('a.docx'))).toBe('Top\n\nBottom');
  });

  test('trims leading and trailing whitespace', async () => {
    setRaw('   \n  Resume text  \n  ');
    expect(await extractWithMock(file('a.docx'))).toBe('Resume text');
  });

  test('passes the file buffer to mammoth', async () => {
    setRaw('x');
    const f = file('a.docx', 'bytes');
    await extractWithMock(f);
    expect(require('mammoth').extractRawText).toHaveBeenCalledWith({ buffer: f.buffer });
  });
});
