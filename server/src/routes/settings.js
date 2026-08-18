import { Router } from 'express';
import { Settings } from '../db.js';
import * as deepseek from '../services/deepseek.js';

const router = Router();
const ok = (res, data, message = 'ok') => res.json({ code: 0, message, data });
const fail = (res, message, status = 400) => res.status(status).json({ code: -1, message, data: null });

// ---------- 获取全部设置 ----------
router.get('/', (req, res) => {
  ok(res, {
    deepseek: {
      tokens: deepseek.listTokens(),
      ...deepseek.getModelConfig()
    },
    agents: req.app.locals.agentManager?.getAgentsInfo().map(a => ({
      id: a.id, name: a.name, icon: a.icon, desc: a.desc, model: a.model, scenario: a.scenario
    })) || []
  });
});

// ---------- 新增 Token ----------
router.post('/deepseek/tokens', (req, res) => {
  try {
    const { name, token } = req.body || {};
    ok(res, { tokens: deepseek.addToken({ name, token }) }, 'Token 已添加');
  } catch (e) {
    fail(res, e.message);
  }
});

// ---------- 更新 Token（启用/禁用/改名） ----------
router.patch('/deepseek/tokens/:id', (req, res) => {
  try {
    const { name, enabled } = req.body || {};
    const patch = {};
    if (name !== undefined) patch.name = name;
    if (enabled !== undefined) patch.enabled = !!enabled;
    ok(res, { tokens: deepseek.updateToken(req.params.id, patch) }, 'Token 已更新');
  } catch (e) {
    fail(res, e.message, 404);
  }
});

// ---------- 删除 Token ----------
router.delete('/deepseek/tokens/:id', (req, res) => {
  try {
    ok(res, { tokens: deepseek.deleteToken(req.params.id) }, 'Token 已删除');
  } catch (e) {
    fail(res, e.message, 404);
  }
});

// ---------- 配置场景默认模型 ----------
router.put('/deepseek/scenario-model', (req, res) => {
  try {
    const { scenario, model } = req.body || {};
    if (!scenario || !model) return fail(res, '参数缺失');
    ok(res, deepseek.setScenarioModel(scenario, model), '默认模型已更新');
  } catch (e) {
    fail(res, e.message);
  }
});

// ---------- 热重载 Agent 配置 ----------
router.post('/agents/reload', (req, res) => {
  req.app.locals.agentManager?.reloadConfigs();
  ok(res, null, 'Agent 配置已热重载');
});

export default router;
