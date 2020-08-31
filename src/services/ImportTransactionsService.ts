import csvParse from 'csv-parse';
import fs from 'fs';
import { getRepository, getCustomRepository, In } from 'typeorm';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionRepository from '../repositories/TransactionsRepository';

interface CSVTransaction {
  title: string;
  type: 'income' | 'outcome';
  value: number;
  category: string;
}

class ImportTransactionsService {
  async execute(filePath: string): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionRepository);
    const categoriesRepository = getRepository(Category);

    const contactsReadStream = fs.createReadStream(filePath);

    const parsers = csvParse({
      from_line: 2, // Começa aler o arquivo .csv a partir da segunda linha
    });

    // pipe() lê a linha conforme ela vai ficando disponível pra leitura
    const parseCSV = contactsReadStream.pipe(parsers);

    // Cria duas consts para que não seja slavo no DB todos de uma só vez.
    const transactions: CSVTransaction[] = [];
    const categories: string[] = [];

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

    // Informa se no BD existe alguma das categorias
    const existentCategories = await categoriesRepository.find({
      where: {
        title: In(categories),
      },
    });

    // Retorna somente os títulos das categorias
    const existentCategoriesTitles = existentCategories.map(
      (category: Category) => category.title,
    );

    // Inclue a categoria se ela ainda não existe
    const addCategoryTitles = categories
      .filter(category => !existentCategoriesTitles.includes(category))
      .filter((value, index, self) => self.indexOf(value) === index);

    const newCategories = categoriesRepository.create(
      addCategoryTitles.map(title => ({
        title,
      })),
    );

    await categoriesRepository.save(newCategories);

    console.log(newCategories);
  }
}

export default ImportTransactionsService;
