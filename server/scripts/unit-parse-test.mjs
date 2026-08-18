// ============================================================
// 解析器单元测试：extractQA / extractDocReady 容错场景
// 覆盖：标准格式、缩进换行、markdown 围栏、尾部冗余、
//       无 dimension 兜底、question 字符串内含 { 等
// 运行：node scripts/unit-parse-test.mjs
// ============================================================
import { extractQA, extractDocReady } from '../src/agents/AgentManager.js';

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

console.log('========== 解析器单元测试 ==========\n');

// 1. 标准格式
console.log('[1] 标准格式');
let qa = extractQA('请确认一下项目类型。\n{"question": "类型是什么？", "option": ["A","B"], "or": "其他", "dimension": "项目类型"}');
check('标准格式可解析', qa?.question === '类型是什么？' && qa?.dimension === '项目类型' && qa?.option.length === 2);

// 2. 带缩进换行的 JSON
console.log('\n[2] 缩进换行格式');
qa = extractQA(`先说明一下。
{
  "question": "项目类型？",
  "option": ["网站", "小程序"],
  "dimension": "项目类型"
}`);
check('缩进换行可解析', qa?.question === '项目类型？' && qa?.dimension === '项目类型');

// 3. markdown 代码围栏 + 尾部冗余
console.log('\n[3] markdown 围栏 + 尾部冗余');
qa = extractQA('接下来问核心功能。\n```json\n{"question": "核心功能？", "option": ["登录"], "dimension": "核心功能"}\n```\n请直接回复即可。');
check('围栏+尾部冗余可解析', qa?.question === '核心功能？' && qa?.dimension === '核心功能');

// 4. 无 dimension 字段 → 兜底 null
console.log('\n[4] 无 dimension 字段');
qa = extractQA('{"question": "有什么补充？", "option": ["无", "有"]}');
check('无 dimension 返回 null', qa !== null && qa?.question === '有什么补充？' && qa?.dimension === null);

// 5. question 字符串内含 { 与 }
console.log('\n[5] question 含花括号字符');
qa = extractQA('{"question": "支持{自定义}格式吗？", "dimension": "技术要求"}');
check('字符串内花括号不干扰', qa?.question === '支持{自定义}格式吗？' && qa?.dimension === '技术要求');

// 6. 键前带空格
console.log('\n[6] 键前空格');
qa = extractQA('{ "question" : "空格键格式？", "dimension": "目标用户" }');
check('键前空格可解析', qa?.question === '空格键格式？' && qa?.dimension === '目标用户');

// 7. 无 JSON → null
console.log('\n[7] 无 JSON 文本');
check('普通文本返回 null', extractQA('你好，请描述你的需求') === null);

// 8. doc_ready 各种格式
console.log('\n[8] doc_ready 提取');
let doc = extractDocReady('# 文档\n内容\n\n{"__doc_ready": true}');
check('标准 doc_ready', doc?.includes('# 文档'));
doc = extractDocReady('# 文档\n\n```json\n{"__doc_ready": true}\n```');
check('围栏 doc_ready', doc?.includes('# 文档'));
doc = extractDocReady('# 文档\n\n{ "__doc_ready": true }');
check('空格 doc_ready', doc?.includes('# 文档'));
doc = extractDocReady('# 文档\n无标记');
check('无标记返回 null', doc === null);

// 9. 多个 { 的文本（说明文字含 JSON 示例）
console.log('\n[9] 说明文字含其它 {');
qa = extractQA('参考格式：{"name":"x"}。现在提问：{"question": "正式问题？", "dimension": "项目类型"}');
check('取最后一个合法 JSON', qa?.question === '正式问题？' && qa?.dimension === '项目类型');

console.log(`\n结果: ${pass} / ${pass + fail} 通过`);
if (fail > 0) { console.log(`失败: ${fail}`); process.exit(1); }
