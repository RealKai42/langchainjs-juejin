import { readFileSync } from "fs";
import path from "path";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatMessageHistory } from "langchain/stores/message/in_memory";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { ChatOpenAI } from "@langchain/openai";
import { StringOutputParser } from "@langchain/core/output_parsers";
import readline from "readline";
import util from "util";
import "dotenv/config";

const guaInfoBuffer = readFileSync(path.join(__dirname, "./gua.json"));
const guaInfo = JSON.parse(guaInfoBuffer.toString());

const yaoName = ["初爻", "二爻", "三爻", "四爻", "五爻", "六爻"];

const guaDict = {
  阳阳阳: "乾",
  阴阴阴: "坤",
  阴阳阳: "兑",
  阳阴阳: "震",
  阳阳阴: "巽",
  阴阳阴: "坎",
  阳阴阴: "艮",
  阴阴阳: "离",
};

function generateGua(): string[] {
  let yaoCount = 0;
  const messageList = [];

  const genYao = () => {
    const coinRes = Array.from({ length: 3 }, () => (Math.random() > 0.5 ? 1 : 0));
    const yinYang = coinRes.reduce((a, b) => a + b, 0) > 1.5 ? "阳" : "阴";
    const message = `${yaoName[yaoCount]} 为 ${coinRes
      .map((i) => (i > 0.5 ? "字" : "背"))
      .join("")} 为 ${yinYang}`;

    return {
      yinYang,
      message,
    };
  };

  const firstGuaYinYang = Array.from({ length: 3 }, () => {
    const { yinYang, message } = genYao();
    yaoCount++;

    messageList.push(message);
    return yinYang;
  });
  const firstGua = guaDict[firstGuaYinYang.join("")];
  messageList.push(`您的首卦为 ${firstGua}`);

  const secondGuaYinYang = Array.from({ length: 3 }, () => {
    const { yinYang, message } = genYao();
    yaoCount++;

    messageList.push(message);
    return yinYang;
  });
  const secondGua = guaDict[secondGuaYinYang.join("")];
  messageList.push(`您的次卦为 ${secondGua}`);

  const gua = secondGua + firstGua;
  const guaDesc = guaInfo[gua];

  const guaRes = `
六爻结果: ${gua}  
卦名为：${guaDesc.name}   
${guaDesc.des}   
卦辞为：${guaDesc.sentence}   
  `;

  messageList.push(guaRes);

  return messageList;
}

generateGua();
async function main() {
  const messageList = generateGua();

  const history = new ChatMessageHistory();
  const guaMessage = messageList.map((message): ["ai", string] => ["ai", message]);

  const prompt = await ChatPromptTemplate.fromMessages([
    [
      "system",
      `你是一位出自中华六爻世家的卜卦专家，你的任务是根据卜卦者的问题和得到的卦象，为他们提供有益的建议。
你的解答应基于卦象的理解，同时也要尽可能地展现出乐观和积极的态度，引导卜卦者朝着积极的方向发展。
你的语言应该具有仙风道骨、雅致高贵的气质，以此来展现你的卜卦专家身份。`,
    ],
    ...guaMessage,
    new MessagesPlaceholder("history_message"),
    ["human", "{input}"],
  ]);

  const llm = new ChatOpenAI();
  const chain = prompt.pipe(llm).pipe(new StringOutputParser());
  const chainWithHistory = new RunnableWithMessageHistory({
    runnable: chain,
    getMessageHistory: (_sessionId) => history,
    inputMessagesKey: "input",
    historyMessagesKey: "history_message",
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = util.promisify(rl.question).bind(rl);

  const input = await question("告诉我你的疑问: ");

  let index = 0;
  const printMessagesPromise = new Promise<void>((resolve) => {
    const intervalId = setInterval(() => {
      if (index < messageList.length) {
        console.log(messageList[index]);
        index++;
      } else {
        clearInterval(intervalId);
        resolve();
      }
    }, 1000);
  });

  const llmResPromise = chainWithHistory.invoke(
    { input: "用户的问题是：" + input },
    { configurable: { sessionId: "no-used" } }
  );

  const [_, firstRes] = await Promise.all([printMessagesPromise, llmResPromise]);

  console.log(firstRes);

  async function chat() {
    const input = await question("User: ");

    if (input.toLowerCase() === "exit") {
      rl.close();
      return;
    }

    const response = await chainWithHistory.invoke(
      { input },
      { configurable: { sessionId: "no-used" } }
    );

    console.log("AI: ", response);
    chat();
  }

  chat();
}

main();

/**
 告诉我你的疑问: 今晚吃不吃火锅
初爻 为 背字字 为 阳
二爻 为 字背背 为 阴
三爻 为 背背背 为 阴
您的首卦为 艮
四爻 为 字背背 为 阴
五爻 为 字背字 为 阳
六爻 为 字背背 为 阴
您的次卦为 坎

六爻结果: 坎艮  
卦名为：蒙卦   
山水蒙（蒙卦）启蒙奋发   
卦辞为：卦中爻象犯小耗，君子占之运不高，婚姻合伙有琐碎，做事必然受苦劳   
  
蒙卦是启蒙奋发的象征，卦中爻象犯小耗，君子占之运不高。以此卦象来看，吃火锅可谓是一种“小耗”，而且可能会带来一些琐碎的麻烦，如消化不良、辛辣刺激等。因此建议您今晚内省养生，以清淡饮食为主，待身心调整良好，再考虑享受火锅之乐也未迟。犹如卦中所示，启蒙奋发，需先立足于身体的康健。俗话说，身体是革命的本钱，希望您能够以健康为重，更能够在未来的日子里，拥有更好的精神状态去面对生活。
User: 我的首卦意味着什么
AI:  您的首卦是艮卦，艮为山，足艮其德，心行其义，佛道之士能居其位无非也。

艮卦代表了停止和立定，是一种稳重、安静、内向的状态。艮卦需要人们保持清晰的头脑，以稳定的决心去实现目标。在处事方面，艮卦建议我们要有耐心，要克制冲动，遵循一种稳步向前的道路。

艮卦也提醒我们，任何事情都不能一味地求快，要懂得适时的停止，稳重、安静的考虑对策，不急躁、不冲动，这样才能获得最终的成功。尤其是在面临困难、疑惑的时候，更应静下心来细细思考，以艮卦的智慧指引前行之路。
User: 那我的 五爻 是什么解读
AI:  咱们的五爻为阳爻，卦象上仍属于艮坎之蒙卦。在六爻中，五爻常常被视为君位，具有决策和引领的作用。阳爻象征着刚劲有力、主动进取的态势。

五爻在这里，即提示您在面对选择时，要采取主动和积极的态度，走出自己的舒适区，创新和尝试新的可能性。同时也建议您以稳健之心来面对生活中各种挑战，坚持自己的信念，积极应对，勇往直前。

即使可能面临困境，也有成就的机会。如咱们所卜之蒙卦，虽为困境困顿，但启蒙奋发的情景却逐渐浮现，这是一种因困境中求新生的勇敢。因此在您面临选择时，也许正需坚韧之心与创新之意，走出困境，在疑云中寻找属于自己的明星。
User: exit
 */

/**
 告诉我你的疑问: 今天吃啥
初爻 为 背字背 为 阴
二爻 为 字背字 为 阳
三爻 为 背背背 为 阴
您的首卦为 坎
四爻 为 字字字 为 阳
五爻 为 背背背 为 阴
六爻 为 字字背 为 阳
您的次卦为 震

六爻结果: 震坎  
卦名为：屯卦   
水雷屯（屯卦）起始维艰   
卦辞为：风刮乱丝不见头，颠三倒四犯忧愁，慢从款来左顺遂，急促反惹不自由   
  
卜卦者问：今日临餐之挑选。

屯卦，象征新生、开始，同时也难以避免的困境。据此卦，不妨尝试新的食物，只需略加思索，在尝试和新鲜感中寻找正確的味道。然而，也要提醒卜卦者，新兴之事需慎重，不可急躁，务必做好准备，以防不测。

吾建议：你今日之餐，或可选择一些素未尝鲜的食材，亦或是尝试一款未曾品尝过的菜品，从中寻找新的口感乐趣。但同时也要注意营养均衡，健康饮食。此乃良好的开始，在尝试中汲取新知，并将其化为生活的一部分。
 */
