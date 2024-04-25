import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { OpenAIEmbeddings } from "@langchain/openai";
import path from "path";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { DynamicTool, DynamicStructuredTool } from "@langchain/core/tools";
import { pull } from "langchain/hub";
import type { PromptTemplate } from "@langchain/core/prompts";
import { AgentExecutor, createOpenAIToolsAgent, createReactAgent } from "langchain/agents";
import { Calculator } from "@langchain/community/tools/calculator";
import { z } from "zod";
import "dotenv/config";

process.env.LANGCHAIN_TRACING_V2 = "true";

async function loadVectorStore() {
  const directory = path.join(__dirname, "../db/qiu");
  const embeddings = new OpenAIEmbeddings();
  const vectorStore = await FaissStore.load(directory, embeddings);

  return vectorStore;
}

async function getRetrieverChain() {
  const prompt = ChatPromptTemplate.fromTemplate(`将以下问题仅基于提供的上下文进行回答：
    上下文：
    {context}

    问题：{input}`);
  const llm = new ChatOpenAI();

  const documentChain = await createStuffDocumentsChain({
    llm,
    prompt,
  });

  const vectorStore = await loadVectorStore();
  const retriever = vectorStore.asRetriever();

  const retrievalChain = await createRetrievalChain({
    combineDocsChain: documentChain,
    retriever,
  });

  return retrievalChain;
}

async function createReactAgentWithTool(tools) {
  const prompt = await pull<PromptTemplate>("hwchase17/react");
  const llm = new ChatOpenAI({
    temperature: 0,
  });

  const agent = await createReactAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  return agentExecutor;
}

async function createToolAgentWithTool(tools) {
  const prompt = await pull<ChatPromptTemplate>("hwchase17/openai-tools-agent");

  const llm = new ChatOpenAI({
    temperature: 0,
  });
  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });
  return agentExecutor;
}

async function testAgent() {
  const retrieverChain = await getRetrieverChain();
  const retrieverTool = new DynamicTool({
    name: "get-qiu-answer",
    func: async (input: string) => {
      const res = await retrieverChain.invoke({ input });
      return res.answer;
    },
    description: "获取小说 《球状闪电》相关问题的答案",
  });

  const stringReverseTool = new DynamicTool({
    name: "string-reverser",
    description: "reverses a string. input should be the string you want to reverse.",
    func: async (input: string) => input.split("").reverse().join(""),
  });

  const dateDiffTool = new DynamicStructuredTool({
    name: "date-difference-calculator",
    description: "计算两个日期之间的天数差",
    schema: z.object({
      date1: z.string().describe("第一个日期，以YYYY-MM-DD格式表示"),
      date2: z.string().describe("第二个日期，以YYYY-MM-DD格式表示"),
    }),
    func: async ({ date1, date2 }) => {
      const d1 = new Date(date1);
      const d2 = new Date(date2);
      const difference = Math.abs(d2.getTime() - d1.getTime());
      const days = Math.ceil(difference / (1000 * 60 * 60 * 24));
      return days.toString();
    },
  });

  const tools = [retrieverTool, dateDiffTool, new Calculator()];
  //   const agents = await createReactAgentWithTool(tools);
  const agents = await createToolAgentWithTool(tools);

  //   const res = await agents.invoke({
  //     input: "小说球状闪电中量子玫瑰的情节",
  //   });

  //   const res = await agents.invoke({
  //     input: "我有 17 个苹果，小明的苹果比我的三倍少 10 个，小明有多少个苹果？",
  //   });

  //   const res = await agents.invoke({
  //     input: "今年是 2024 年，今年 5.1 和 10.1 之间有多少天？",
  //   });

  //   console.log(res);
}

// testAgent();

async function testAgentRoute() {
  const retrieverChain = await getRetrieverChain();
  const retrieverTool = new DynamicTool({
    name: "get-qiu-answer",
    func: async (input: string) => {
      const res = await retrieverChain.invoke({ input });
      return res.answer;
    },
    description: "获取小说 《球状闪电》相关问题的答案",
    returnDirect: true,
  });

  const tools = [retrieverTool, new Calculator()];
  const agents = await createReactAgentWithTool(tools);

  const res = await agents.invoke({
    input: "用一句话，介绍小说球状闪电中，跟量子玫瑰有关的情节",
  });
  console.log(res);
}

// testAgentRoute();
