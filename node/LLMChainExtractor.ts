import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import "dotenv/config";
import { LLMChainExtractor } from "langchain/retrievers/document_compressors/chain_extract";
import { ContextualCompressionRetriever } from "langchain/retrievers/contextual_compression";

process.env.LANGCHAIN_VERBOSE = "true";

async function run() {
  const directory = "../db/kongyiji";
  const embeddings = new OpenAIEmbeddings();
  const vectorstore = await FaissStore.load(directory, embeddings);

  const model = new ChatOpenAI();
  const compressor = LLMChainExtractor.fromLLM(model);

  const retriever = new ContextualCompressionRetriever({
    baseCompressor: compressor,
    baseRetriever: vectorstore.asRetriever(2),
  });
  const res = await retriever.invoke("茴香豆是做什么用的");
  console.log(res);
}

run();
