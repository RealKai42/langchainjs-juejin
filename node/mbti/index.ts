import { readFileSync } from "fs";
import path from "path";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";
import { RunnableSequence } from "@langchain/core/runnables";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { z } from "zod";
import "dotenv/config";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIToolsAgent, createReactAgent } from "langchain/agents";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import readline from "readline";
import { Calculator } from "@langchain/community/tools/calculator";

process.env.LANGCHAIN_TRACING_V2 = "true";

const mbtiInfoBuffer = readFileSync(path.join(__dirname, "./mbti-info.json"));
const mbtiInfo = JSON.parse(mbtiInfoBuffer.toString());
const mbtiList = [
  "ISTJ",
  "ISFJ",
  "INFJ",
  "INTJ",
  "ISTP",
  "ISFP",
  "INFP",
  "INTP",
  "ESTP",
  "ESFP",
  "ENFP",
  "ENTP",
  "ESTJ",
  "ESFJ",
  "ENFJ",
  "ENTJ",
] as [string, ...string[]];

async function getMBTIChatChain() {
  const prompt = ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一个共情能力非常强的心理医生，并且很了解MBTI（迈尔斯-布里格斯性格类型指标)的各种人格类型，你的任务是根据来访者的 MBTI 和问题，给出针对性的情感支持，你的回答要富有感情、有深度和充足的情感支持，引导来访者乐观积极面对问题",
    ],
    ["human", "用户的 MBTI 类型是{type}, 这个类型的特点是{info}, 他的问题是{question}"],
  ]);

  const model = new ChatOpenAI();
  const mbtiChain = RunnableSequence.from([prompt, model, new StringOutputParser()]);

  return mbtiChain;
}

async function getAgent() {
  const mbtiChatChain = await getMBTIChatChain();

  const mbtiTool = new DynamicStructuredTool({
    name: "get-mbti-chat",
    schema: z.object({
      type: z.enum(mbtiList).describe("用户的 MBTI 类型"),
      question: z.string().describe("用户的问题"),
    }),
    func: async ({ type, question }) => {
      const info = mbtiInfo[type];

      const res = await mbtiChatChain.invoke({ type, question, info });
      return res;
    },
    description: "根据用户的问题和 MBTI 类型，回答用户的问题",
  });

  const tools = [mbtiTool];

  const agentPrompt = await ChatPromptTemplate.fromMessages([
    [
      "system",
      "你是一个用户接待的 agent，通过自然语言询问用户的 MBTI 类型和问题，直到你有足够的信息调用 get-mbti-chat 来回答用户的问题",
    ],
    new MessagesPlaceholder("history_message"),
    ["human", "{input}"],
    new MessagesPlaceholder("agent_scratchpad"),
  ]);

  const llm = new ChatOpenAI({
    temperature: 0.4,
  });
  const agent = await createOpenAIToolsAgent({
    llm,
    tools,
    prompt: agentPrompt,
  });

  const agentExecutor = new AgentExecutor({
    agent,
    tools,
  });

  const messageHistory = new ChatMessageHistory();

  const agentWithChatHistory = new RunnableWithMessageHistory({
    runnable: agentExecutor,
    getMessageHistory: () => messageHistory,
    inputMessagesKey: "input",
    historyMessagesKey: "history_message",
  });

  return agentWithChatHistory;
}

async function main() {
  const agent = await getAgent();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  function chat() {
    rl.question("User: ", async (input) => {
      if (input.toLowerCase() === "exit") {
        rl.close();
        return;
      }

      const response = await agent.invoke(
        {
          input,
        },
        {
          configurable: {
            sessionId: "no-used",
          },
        }
      );

      console.log("Agent: ", response.output);

      chat();
    });
  }

  console.log("请输入问题。 输入 exit 退出聊天。");
  chat();
}

main();

/**
 * 请输入问题。 输入 exit 退出聊天。
User: 我应该做点啥?
Agent:  当然，我很乐意帮助你。但是，我需要更多的信息才能给出最佳建议。你可以告诉我你的 MBTI 类型吗？这将帮助我更好地理解你的个性和偏好。
User: 我也不知道我的类型,我是偏内向和没有计划的
Agent:  了解了，你的描述可能对应于几种 MBTI 类型。你是否喜欢深入思考和理解事物，还是更倾向于实际操作和直观理解？你在做决定时更依赖逻辑分析还是情感和价值观？这些信息可以帮助我更准确地确定你的 MBTI 类型。
User: 我希望深入思考和实际操作 逻辑分析
Agent:  根据你的描述，你可能是 INTJ 或者 INTP 类型。这两种类型的人都是内向、直观、思考型的人，但主要的区别在于 J 类型的人通常更喜欢有计划和结构，而 P 类型的人更喜欢灵活和开放。你刚才提到你没有计划，所以我猜你可能是 INTP 类型。你是否认同这个判断？
User: 我应该是更加有计划和结构的吧
Agent:  好的，那么你可能是 INTJ 类型的人。让我们继续你的问题，你想要做些什么？你可以提供一些具体的上下文吗？例如，你是在寻找新的职业道路，还是想找一些业余爱好？
User: 我在纠结今晚吃不吃火锅
> 
> 我在纠结Agent:  根据你的 INTJ 性格类型，你是一个善于策划和执行的人，同时具有强烈的洞察力。你可以一步步地思考和规划生活的各种细节，这也包括你的饮食选择。

火锅是一种社交的餐饮方式，可以提供大量的膳食选择，从各种肉类、蔬菜、豆制品到各种小吃，几乎可以满足所有人的口味。这种丰富的选择也正符合你作为 INTJ 类型的性格特点，即多元而独特。

如果你正在寻找一种放松自己，调剂生活的方式，或者想和朋友们享受一个美妙的晚餐，那么今晚吃火锅绝对是一个不错的选择。同时，请记住，生活中的决定就像你面前的火锅一样多元和丰富，你有能力作出最适合自己的选择。

所以，如果你喜欢火锅，并且觉得今晚吃火锅可以让你感到愉快，那么就去吃吧！希望你今晚过得愉快！
 */
