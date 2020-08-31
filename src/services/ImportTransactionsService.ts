import csvParse from 'csv-parse';
import fs from 'fs';

import Transaction from '../models/Transaction';

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const contactsReadStream = fs.createReadStream(filePath);

    const parsers = csvParse({
      from_line: 2, // Começa aler o arquivo .csv a partir da segunda linha
    });

    // pipe() lê a linha conforme ela vai ficando disponível pra leitura
    const parseCSV = contactsReadStream.pipe(parsers);

    // Cria duas consts para que não seja slavo no DB todos de uma só vez.
    const transactions = [];
    const categories = [];

    /*
      Pega cada linha retirando o espaço entre cada elemento
      evitando abrir uma conexão para cada registro
    */
    parseCSV.on('data', async line => {
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value) return;

      categories.push(category);

      transactions.push({ title, type, value, category });
    });
    await new Promise(resolve => parseCSV.on('end', resolve));

    return { categories, transactions };
  }
}

export default ImportTransactionsService;
