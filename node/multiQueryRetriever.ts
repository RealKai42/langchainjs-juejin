import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { MultiQueryRetriever } from "langchain/retrievers/multi_query";
import "faiss-node";
import "dotenv/config";

async function run() {
  const directory = "../db/kongyiji";
  const embeddings = new OpenAIEmbeddings();
  const vectorstore = await FaissStore.load(directory, embeddings);

  const model = new ChatOpenAI();
  const retriever = MultiQueryRetriever.fromLLM({
    llm: model,
    retriever: vectorstore.asRetriever(3),
    queryCount: 3,
    verbose: true,
  });
  const res = await retriever.invoke("茴香豆是做什么用的");

  console.log(res);
}

run();
