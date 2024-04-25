import { ChatOpenAI } from "@langchain/openai";
import { SerpAPI } from "@langchain/community/tools/serpapi";
import "dotenv/config";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import type { PromptTemplate } from "@langchain/core/prompts";
import { Calculator } from "@langchain/community/tools/calculator";

process.env.LANGCHAIN_TRACING_V2 = "true";

async function main() {
  const tools = [new SerpAPI(process.env.SERP_KEY), new Calculator()];

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

  const result = await agentExecutor.invoke({
    input: "我有 17 美元，现在相当于多少人民币？",
  });

  console.log(result);
}

main();
