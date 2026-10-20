const RULES = [
  {
    id: 'mul',
    label: 'Multiply',
    short: 'a × b',
    tex: 'f = a \\times b, \\qquad \\frac{\\partial f}{\\partial a} = b, \\qquad \\frac{\\partial f}{\\partial b} = a',
    summary: '一个输入的取值成为另一个输入梯度的缩放因子。',
    explanation: '当两个值相乘时，每个父节点接收的上游梯度都会以另一个父节点为比例进行缩放。这是线性层最重要的规则，因为权重与激活值正是在此相遇。',
  },
  {
    id: 'add',
    label: 'Add',
    short: 'a + b',
    tex: 'f = a + b, \\qquad \\frac{\\partial f}{\\partial a} = 1, \\qquad \\frac{\\partial f}{\\partial b} = 1',
    summary: '加法只是把上游梯度复制给每个父节点。',
    explanation: '加法节点不做任何缩放。每个父节点都原样接收相同的上游信息。当多条路径汇合时，梯度累加正是在这里变得可见。',
  },
  {
    id: 'exp',
    label: 'Exponent',
    short: 'exp(a)',
    tex: 'f = e^a, \\qquad \\frac{\\partial f}{\\partial a} = e^a = f',
    summary: '指数函数的导数就是它自身。',
    explanation: '这正是前向传播会缓存输出的原因。一旦已知 e^a，反向规则便立即可得：把上游梯度乘以那个存储的输出。',
  },
  {
    id: 'reciprocal',
    label: 'Reciprocal',
    short: '1 / a',
    tex: 'f = \\frac{1}{a}, \\qquad \\frac{\\partial f}{\\partial a} = -\\frac{1}{a^2}',
    summary: '倒数会翻转符号并对分母取平方。',
    explanation: 'sigmoid 可以先构造分母，再通过倒数来实现。此处的符号翻转是学习者常常跟丢思路的环节之一，因此把它单独拎出来会有所帮助。',
  },
  {
    id: 'log',
    label: 'Log',
    short: 'log(a)',
    tex: 'f = \\log(a), \\qquad \\frac{\\partial f}{\\partial a} = \\frac{1}{a}',
    summary: '对数把乘法变为加法，并把它的梯度变为倒数。',
    explanation: '交叉熵式损失以对数收尾。一旦上游梯度到达对数节点，剩下的局部工作就只有乘以 1/a。',
  },
];

const SINGLE_INPUT = { x: 1.6, w: 1.15, b: -0.8 };
const FORWARD_STAGE_END = 8;
const FINAL_STAGE = 17;

const GRAPH_NODES = [
  { id: 'x', label: 'x', sub: 'input', x: 120, y: 170, kind: 'input', forwardStep: 0, backwardStep: 16 },
  { id: 'w', label: 'w', sub: 'parameter', x: 120, y: 350, kind: 'parameter', forwardStep: 0, backwardStep: 16 },
  { id: 'mul', label: 'wx', sub: 'multiply', x: 330, y: 260, kind: 'op', forwardStep: 1, backwardStep: 15 },
  { id: 'b', label: 'b', sub: 'parameter', x: 330, y: 440, kind: 'parameter', forwardStep: 0, backwardStep: 15 },
  { id: 'z', label: 'z', sub: 'add', x: 540, y: 350, kind: 'op', forwardStep: 2, backwardStep: 14 },
  { id: 'neg', label: '-z', sub: 'negate', x: 750, y: 350, kind: 'op', forwardStep: 3, backwardStep: 13 },
  { id: 'exp', label: 'e^-z', sub: 'exp', x: 960, y: 350, kind: 'op', forwardStep: 4, backwardStep: 13 },
  { id: 'denom', label: '1 + exp', sub: 'add', x: 1170, y: 350, kind: 'op', forwardStep: 5, backwardStep: 12 },
  { id: 'p', label: 'p', sub: 'sigmoid', x: 1350, y: 350, kind: 'op', forwardStep: 6, backwardStep: 11 },
  { id: 'logp', label: 'log p', sub: 'log', x: 1350, y: 170, kind: 'op', forwardStep: 7, backwardStep: 10 },
  { id: 'L', label: 'L', sub: 'loss', x: 1350, y: 530, kind: 'loss', forwardStep: 8, backwardStep: 9 },
];

const GRAPH_EDGES = [
  { id: 'x-mul', from: 'x', to: 'mul' },
  { id: 'w-mul', from: 'w', to: 'mul' },
  { id: 'mul-z', from: 'mul', to: 'z' },
  { id: 'b-z', from: 'b', to: 'z' },
  { id: 'z-neg', from: 'z', to: 'neg' },
  { id: 'neg-exp', from: 'neg', to: 'exp' },
  { id: 'exp-denom', from: 'exp', to: 'denom' },
  { id: 'denom-p', from: 'denom', to: 'p' },
  { id: 'p-logp', from: 'p', to: 'logp' },
  { id: 'logp-L', from: 'logp', to: 'L' },
];

const GRAPH_STAGES = [
  {
    direction: 'Setup',
    focus: 'Inputs',
    activeNodes: ['x', 'w', 'b'],
    activeEdges: [],
    formula: 'z = wx + b',
    headline: (s) => '在任何运算发生之前，输入是已知的。',
    explanation: (s) => `样本以 <code>x = ${formatNumber(s.values.x)}</code> 的形式给出。可学习参数初始为 <code>w = ${formatNumber(s.values.w)}</code> 与 <code>b = ${formatNumber(s.values.b)}</code>。因为损失尚未构建，所以还不存在任何梯度。`,
  },
  {
    direction: 'Forward',
    focus: 'Multiply',
    activeNodes: ['x', 'w', 'mul'],
    activeEdges: ['x-mul', 'w-mul'],
    formula: 'wx = w \\cdot x',
    headline: (s) => '第一个运算生成加权输入。',
    explanation: (s) => `乘法运算生成 <code>wx = ${formatNumber(s.values.mul)}</code>。稍后当梯度返回时，该节点会把 <code>x</code> 发回 <code>w</code>，并把 <code>w</code> 发回 <code>x</code>。`,
  },
  {
    direction: 'Forward',
    focus: '加上偏置',
    activeNodes: ['mul', 'b', 'z'],
    activeEdges: ['mul-z', 'b-z'],
    formula: 'z = wx + b',
    headline: (s) => '加上偏置便得到 logit。',
    explanation: (s) => `加法节点将加权输入与偏置结合，生成 <code>z = ${formatNumber(s.values.z)}</code>。加法在反向传播中很简单：它把上游梯度复制给两个父节点。`,
  },
  {
    direction: 'Forward',
    focus: 'Negate',
    activeNodes: ['z', 'neg'],
    activeEdges: ['z-neg'],
    formula: '-z = -1 \\cdot z',
    headline: (s) => 'sigmoid 首先翻转 logit 的符号。',
    explanation: (s) => `计算图现在存储 <code>-z = ${formatNumber(s.values.neg)}</code>。这次取负看似微小，但之后很重要，因为它贡献了 <code>-1</code> 的局部导数。`,
  },
  {
    direction: 'Forward',
    focus: 'Exponent',
    activeNodes: ['neg', 'exp'],
    activeEdges: ['neg-exp'],
    formula: 'e^{-z} = \\exp(-z)',
    headline: (s) => '指数运算把取负后的 logit 变为一个正的缩放因子。',
    explanation: (s) => `指数节点存储 <code>e^{-z} = ${formatNumber(s.values.exp)}</code>。由于 <code>e^a</code> 的导数就是它自身，前向输出正是反向规则所需要的。`,
  },
  {
    direction: 'Forward',
    focus: 'Denominator',
    activeNodes: ['exp', 'denom'],
    activeEdges: ['exp-denom'],
    formula: 'd = 1 + e^{-z}',
    headline: (s) => '为了倒数步骤，一个分母出现了。',
    explanation: (s) => `加上 <code>1</code> 得到 <code>d = ${formatNumber(s.values.denom)}</code>。这个隐含常数在视觉上并不重要，因此图中省略了它，但数值状态仍然体现了它。`,
  },
  {
    direction: 'Forward',
    focus: 'sigmoid 概率',
    activeNodes: ['denom', 'p'],
    activeEdges: ['denom-p'],
    formula: 'p = \\frac{1}{d}',
    headline: (s) => '倒数把分母转换为概率。',
    explanation: (s) => `sigmoid 输出为 <code>p = ${formatNumber(s.values.p)}</code>。对这个正类样本而言，概率越大意味着损失越小。`,
  },
  {
    direction: 'Forward',
    focus: 'Log',
    activeNodes: ['p', 'logp'],
    activeEdges: ['p-logp'],
    formula: '\\log p = \\log(p)',
    headline: (s) => '损失路径进行对数运算。',
    explanation: (s) => `计算图存储 <code>\\log(p) = ${formatNumber(s.values.logp)}</code>。对数把概率转换为一个当模型出错时会急剧增大的量。`,
  },
  {
    direction: 'Forward',
    focus: 'Loss',
    activeNodes: ['logp', 'L'],
    activeEdges: ['logp-L'],
    formula: 'L = -\\log p',
    headline: (s) => '标量损失现在已就绪。',
    explanation: (s) => `对对数取负得到 <code>L = ${formatNumber(s.values.L)}</code>。只有到这时反向传播才能开始，因为引擎终于有了可供求导的标量目标。`,
  },
  {
    direction: 'Backward',
    focus: '为损失播种',
    activeNodes: ['L'],
    activeEdges: [],
    formula: '\\frac{\\partial L}{\\partial L} = 1',
    headline: (s) => '反向传播首先以梯度 1 为损失播种。',
    explanation: (s) => `每一次反向传播都以 <code>\\partial L / \\partial L = 1</code> 起始。这个种子表明：若损失发生微小变化，它就恰好变化这么多。`,
  },
  {
    direction: 'Backward',
    focus: '穿过最后的取负',
    activeNodes: ['L', 'logp'],
    activeEdges: ['logp-L'],
    formula: '\\frac{\\partial L}{\\partial \\log p} = \\frac{\\partial L}{\\partial L} \\cdot (-1)',
    headline: (s) => '最后的取负把一个干净的梯度 -1 发送给 log p。',
    explanation: (s) => `因为 <code>L = -\\log(p)</code>，所以 <code>\\log p</code> 处的梯度变为 <code>${formatNumber(s.grads.logp)}</code>。结构已经很清晰：上游梯度乘以局部导数。`,
  },
  {
    direction: 'Backward',
    focus: '穿过对数',
    activeNodes: ['logp', 'p'],
    activeEdges: ['p-logp'],
    formula: '\\frac{\\partial L}{\\partial p} = \\frac{\\partial L}{\\partial \\log p} \\cdot \\frac{1}{p}',
    headline: (s) => '对数把梯度转换为倒数比例。',
    explanation: (s) => `<code>\\log(p)</code> 的局部导数是 <code>1/p</code>，因此概率接收到的梯度为 <code>${formatNumber(s.grads.p)}</code>。越自信却越错误的概率受到的惩罚越大。`,
  },
  {
    direction: 'Backward',
    focus: '穿过倒数',
    activeNodes: ['p', 'denom'],
    activeEdges: ['denom-p'],
    formula: '\\frac{\\partial L}{\\partial d} = \\frac{\\partial L}{\\partial p} \\cdot \\left(-\\frac{1}{d^2}\\right)',
    headline: (s) => '倒数翻转符号并对分母取平方。',
    explanation: (s) => `分母继承的梯度为 <code>${formatNumber(s.grads.denom)}</code>。这一步正是倒数规则充分发挥作用之处：取负号、分母平方。`,
  },
  {
    direction: 'Backward',
    focus: '穿过指数',
    activeNodes: ['denom', 'exp', 'neg'],
    activeEdges: ['exp-denom', 'neg-exp'],
    formula: '\\frac{\\partial L}{\\partial (-z)} = \\frac{\\partial L}{\\partial e^{-z}} \\cdot e^{-z}',
    headline: (s) => '指数运算用自身的输出缩放上游信息。',
    explanation: (s) => `由于 <code>e^{-z}</code> 的导数是 <code>e^{-z}</code>，取负后的 logit 接收到的梯度为 <code>${formatNumber(s.grads.neg)}</code>。这正是缓存前向输出如此有用的原因。`,
  },
  {
    direction: 'Backward',
    focus: '撤销符号翻转',
    activeNodes: ['neg', 'z'],
    activeEdges: ['z-neg'],
    formula: '\\frac{\\partial L}{\\partial z} = \\frac{\\partial L}{\\partial (-z)} \\cdot (-1)',
    headline: (s) => '取负节点再一次翻转符号。',
    explanation: (s) => `logit 处的梯度变为 <code>${formatNumber(s.grads.z)}</code>。对于正类样本，该值等于 <code>p - 1</code>，这正是当概率仍小于 1 时优化器会把 logit 往上推的原因。`,
  },
  {
    direction: 'Backward',
    focus: '在加法处分流',
    activeNodes: ['z', 'mul', 'b'],
    activeEdges: ['mul-z', 'b-z'],
    formula: '\\frac{\\partial L}{\\partial wx} = \\frac{\\partial L}{\\partial z}, \\qquad \\frac{\\partial L}{\\partial b} = \\frac{\\partial L}{\\partial z}',
    headline: (s) => '加法节点把同一条信息复制给两个父节点。',
    explanation: (s) => `<code>wx</code> 与 <code>b</code> 都接收 <code>${formatNumber(s.grads.z)}</code>。这是规则表中最干净的一条：加法只是把上游梯度原样转发。`,
  },
  {
    direction: 'Backward',
    focus: '穿过乘法',
    activeNodes: ['mul', 'w', 'x'],
    activeEdges: ['x-mul', 'w-mul'],
    formula: '\\frac{\\partial L}{\\partial w} = \\frac{\\partial L}{\\partial wx} \\cdot x, \\qquad \\frac{\\partial L}{\\partial x} = \\frac{\\partial L}{\\partial wx} \\cdot w',
    headline: (s) => '乘法节点把 logit 梯度转换为参数梯度。',
    explanation: (s) => `因为另一个父节点充当局部导数，所以权重接收 <code>${formatNumber(s.grads.w)}</code>，而若我们需要输入端的梯度，它会接收 <code>${formatNumber(s.grads.x)}</code>。`,
  },
  {
    direction: 'Backward',
    focus: '可供优化器使用的梯度',
    activeNodes: ['w', 'b', 'x'],
    activeEdges: [],
    formula: '\\nabla_{w,b} L = \\left[\\frac{\\partial L}{\\partial w}, \\frac{\\partial L}{\\partial b}\\right]',
    headline: (s) => '反向传播结束时，梯度落在叶节点上。',
    explanation: (s) => `对这个样本，优化器看到 <code>dL/dw = ${formatNumber(s.grads.w)}</code> 与 <code>dL/db = ${formatNumber(s.grads.b)}</code>。在批量中，这些信息会在更新之前跨多个样本累加。`,
  },
];

const MODULE_VIEWS = {
  micro: {
    headline: '原子计算图：每个局部导数都是显式的。',
    body: '这对学习引擎本身而言是理想形式。每个节点都很小，每条依赖关系都可见，每条反向规则都是一行局部事实。',
    bullets: [
      { title: '线性得分被分解', text: '权重与输入的乘法以及偏置加法以独立步骤出现。' },
      { title: 'sigmoid 并不神秘', text: '它不过是取负、指数、加一与倒数。' },
      { title: '损失保持诚实', text: '一次对数运算与一次最终取负构成完整的标量目标。' },
    ],
    nodes: [
      { id: 'x', label: 'x', x: 90, y: 130, w: 96, h: 56, fill: '#eef7ff' },
      { id: 'w', label: 'w', x: 90, y: 250, w: 96, h: 56, fill: '#eef3ff' },
      { id: 'mul', label: '×', x: 250, y: 190, w: 104, h: 62, fill: '#ffffff' },
      { id: 'b', label: 'b', x: 250, y: 310, w: 96, h: 56, fill: '#eef3ff' },
      { id: 'add', label: '+', x: 410, y: 250, w: 104, h: 62, fill: '#ffffff' },
      { id: 'neg', label: '−', x: 570, y: 250, w: 104, h: 62, fill: '#ffffff' },
      { id: 'exp', label: 'exp', x: 730, y: 250, w: 120, h: 62, fill: '#ffffff' },
      { id: 'inv', label: '1/x', x: 890, y: 250, w: 120, h: 62, fill: '#ffffff' },
      { id: 'log', label: 'log', x: 1030, y: 170, w: 110, h: 62, fill: '#ffffff' },
      { id: 'loss', label: 'L', x: 1030, y: 330, w: 110, h: 62, fill: '#fff2ef' },
    ],
    edges: [
      ['x', 'mul'], ['w', 'mul'], ['mul', 'add'], ['b', 'add'], ['add', 'neg'], ['neg', 'exp'], ['exp', 'inv'], ['inv', 'log'], ['log', 'loss'],
    ],
  },
  modules: {
    headline: '框架模块：相同的数学，更少的可见节点。',
    body: 'PyTorch、JAX 等同侪并没有删除链式法则。它们把许多微小运算打包在更大的接口之后，而这些接口中的每一个仍然懂得如何反向传播。',
    bullets: [
      { title: 'nn.Linear（线性层）', text: '隐藏乘法与加法的细节，同时仍产生可微的输出。' },
      { title: 'Sigmoid', text: '封装了若干标量运算，但仍能返回正确的梯度。' },
      { title: '交叉熵式损失', text: '尽管其反向规则内部可能经过优化，它表现得就像一个干净的模块。' },
    ],
    nodes: [
      { id: 'x', label: 'x', x: 90, y: 180, w: 96, h: 56, fill: '#eef7ff' },
      { id: 'params', label: 'w, b', x: 90, y: 300, w: 120, h: 56, fill: '#eef3ff' },
      { id: 'linear', label: 'nn.Linear（线性层）', x: 320, y: 240, w: 190, h: 78, fill: '#ecf2ff' },
      { id: 'sigmoid', label: 'Sigmoid', x: 620, y: 240, w: 170, h: 78, fill: '#eefcf7' },
      { id: 'loss', label: '交叉熵', x: 910, y: 240, w: 190, h: 78, fill: '#fff2ef' },
      { id: 'out', label: 'L', x: 1075, y: 120, w: 90, h: 56, fill: '#fff2ef' },
    ],
    edges: [
      ['x', 'linear'], ['params', 'linear'], ['linear', 'sigmoid'], ['sigmoid', 'loss'], ['loss', 'out'],
    ],
  },
};

const BATCH_DATASETS = {
  easy: {
    label: '清晰的分离',
    description: '左侧有两个负类样本，右侧有一个正类样本。该批次主要要求更陡的正向斜率。',
    defaults: { w: 1.2, b: -0.1 },
    points: [
      { name: 'A', x: -2.2, y: 0 },
      { name: 'B', x: -0.6, y: 0 },
      { name: 'C', x: 2.0, y: 1 },
    ],
  },
  edge: {
    label: '靠近决策边界',
    description: '三个点都位于决策边界附近，因此更新必须谨慎地同时移动斜率与截距。',
    defaults: { w: 0.65, b: 0.15 },
    points: [
      { name: 'A', x: -0.9, y: 0 },
      { name: 'B', x: 0.15, y: 1 },
      { name: 'C', x: 0.85, y: 1 },
    ],
  },
  outlier: {
    label: '一个不一致的点',
    description: '一个离群点与其他两行相抵触，这正是让梯度平均变得真切可感的那类张力。',
    defaults: { w: 1.0, b: -0.2 },
    points: [
      { name: 'A', x: -2.0, y: 0 },
      { name: 'B', x: 0.2, y: 1 },
      { name: 'C', x: 1.9, y: 0 },
    ],
  },
};

const state = {
  selectedRule: RULES[0].id,
  graphStage: 0,
  moduleMode: 'micro',
  batch: {
    datasetKey: 'easy',
    w: BATCH_DATASETS.easy.defaults.w,
    b: BATCH_DATASETS.easy.defaults.b,
    lr: 0.2,
  },
};

let autoPlayHandle = null;
const graphSnapshot = computeSingleExample(SINGLE_INPUT);

const els = {
  progressFill: document.getElementById('progressFill'),
  tocLinks: Array.from(document.querySelectorAll('.toc__link')),
  sections: Array.from(document.querySelectorAll('[data-nav]')),
  ruleChips: document.getElementById('ruleChips'),
  ruleGrid: document.getElementById('ruleGrid'),
  ruleTitle: document.getElementById('ruleTitle'),
  ruleFormula: document.getElementById('ruleFormula'),
  ruleExplanation: document.getElementById('ruleExplanation'),
  graphSvg: document.getElementById('graphSvg'),
  stageIndex: document.getElementById('stageIndex'),
  stageDirection: document.getElementById('stageDirection'),
  stageFocus: document.getElementById('stageFocus'),
  stageHeadline: document.getElementById('stageHeadline'),
  stageExplanation: document.getElementById('stageExplanation'),
  chainRuleMath: document.getElementById('chainRuleMath'),
  nodeTable: document.getElementById('nodeTable'),
  stageScrubber: document.getElementById('stageScrubber'),
  resetGraph: document.getElementById('resetGraph'),
  stepForward: document.getElementById('stepForward'),
  stepBackward: document.getElementById('stepBackward'),
  autoPlay: document.getElementById('autoPlay'),
  exportStage: document.getElementById('exportStage'),
  exportTimeline: document.getElementById('exportTimeline'),
  moduleSvg: document.getElementById('moduleSvg'),
  moduleHeadline: document.getElementById('moduleHeadline'),
  moduleBody: document.getElementById('moduleBody'),
  moduleList: document.getElementById('moduleList'),
  modeChips: Array.from(document.querySelectorAll('[data-mode]')),
  datasetSwitcher: document.getElementById('datasetSwitcher'),
  batchSvg: document.getElementById('batchSvg'),
  meanLoss: document.getElementById('meanLoss'),
  gradW: document.getElementById('gradW'),
  gradB: document.getElementById('gradB'),
  learningRateValue: document.getElementById('learningRateValue'),
  paramW: document.getElementById('paramW'),
  paramWValue: document.getElementById('paramWValue'),
  paramB: document.getElementById('paramB'),
  paramBValue: document.getElementById('paramBValue'),
  learningRate: document.getElementById('learningRate'),
  learningRateInline: document.getElementById('learningRateInline'),
  batchNarrative: document.getElementById('batchNarrative'),
  exampleTableBody: document.getElementById('exampleTableBody'),
  resetBatch: document.getElementById('resetBatch'),
  applyBatchStep: document.getElementById('applyBatchStep'),
  exportBatch: document.getElementById('exportBatch'),
};

function stripMathDelimiters(text) {
  return text.replace(/^\s*\\\[/, '').replace(/\\\]\s*$/, '').trim();
}

function renderTex(element, tex, displayMode = true) {
  if (!element) return;
  if (window.katex && typeof window.katex.render === 'function') {
    window.katex.render(stripMathDelimiters(tex), element, {
      displayMode,
      throwOnError: false,
    });
  } else {
    element.textContent = stripMathDelimiters(tex);
  }
}

function renderStaticMath() {
  document.querySelectorAll('[data-katex-display]').forEach((element) => {
    renderTex(element, element.textContent, true);
  });
}

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function clampProbability(value) {
  return Math.min(1 - 1e-7, Math.max(1e-7, value));
}

function formatNumber(value, digits = 3) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  const normalized = Object.is(rounded, -0) ? 0 : rounded;
  return normalized.toFixed(digits);
}

function formatSigned(value, digits = 3) {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  const text = formatNumber(Math.abs(value), digits);
  return value >= 0 ? `+${text}` : `-${text}`;
}

function computeSingleExample({ x, w, b }) {
  const values = {
    x,
    w,
    b,
  };
  values.mul = w * x;
  values.z = values.mul + b;
  values.neg = -values.z;
  values.exp = Math.exp(values.neg);
  values.denom = 1 + values.exp;
  values.p = 1 / values.denom;
  values.logp = Math.log(values.p);
  values.L = -values.logp;

  const grads = {
    L: 1,
  };
  grads.logp = grads.L * -1;
  grads.p = grads.logp * (1 / values.p);
  grads.denom = grads.p * (-1 / (values.denom * values.denom));
  grads.exp = grads.denom;
  grads.neg = grads.exp * values.exp;
  grads.z = grads.neg * -1;
  grads.mul = grads.z;
  grads.b = grads.z;
  grads.w = grads.mul * values.x;
  grads.x = grads.mul * values.w;

  return { values, grads };
}

function graphVisibleState(stage) {
  return GRAPH_NODES.reduce((acc, node) => {
    acc[node.id] = {
      value: stage >= node.forwardStep ? graphSnapshot.values[node.id] : null,
      grad: stage >= node.backwardStep ? graphSnapshot.grads[node.id] : null,
      active: GRAPH_STAGES[stage].activeNodes.includes(node.id),
    };
    return acc;
  }, {});
}

function graphNodeColors(node, visible, direction) {
  const activeForward = direction === 'Forward' && visible.active;
  const activeBackward = direction === 'Backward' && visible.active;
  const fills = {
    input: '#eef7ff',
    parameter: '#eef3ff',
    op: '#ffffff',
    loss: '#fff4ef',
  };
  const fill = activeForward ? '#e8f0ff' : activeBackward ? '#fff0eb' : fills[node.kind] || '#ffffff';
  const stroke = activeForward ? '#345ff6' : activeBackward || visible.grad !== null ? '#f0624d' : '#b9c4cf';
  const glow = activeForward
    ? 'drop-shadow(0 18px 22px rgba(52,95,246,0.18))'
    : activeBackward
      ? 'drop-shadow(0 18px 22px rgba(240,98,77,0.18))'
      : 'none';
  return { fill, stroke, glow };
}

function edgePath(edge) {
  const from = GRAPH_NODES.find((node) => node.id === edge.from);
  const to = GRAPH_NODES.find((node) => node.id === edge.to);
  if (!from || !to) return '';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const startX = from.x + 76;
  const startY = from.y;
  const endX = to.x - 76;
  const endY = to.y;
  if (edge.id === 'p-logp') {
    return `M ${from.x} ${from.y - 44} C ${from.x} ${from.y - 120}, ${to.x} ${to.y + 120}, ${to.x} ${to.y + 44}`;
  }
  if (edge.id === 'logp-L') {
    return `M ${from.x} ${from.y + 44} C ${from.x + 90} ${from.y + 120}, ${to.x + 90} ${to.y - 120}, ${to.x} ${to.y - 44}`;
  }
  return `M ${startX} ${startY} C ${startX + dx * 0.38} ${startY + dy * 0.08}, ${endX - dx * 0.2} ${endY - dy * 0.08}, ${endX} ${endY}`;
}

function nodeMarkup(node, visible, direction) {
  const { fill, stroke, glow } = graphNodeColors(node, visible, direction);
  const badgeY = 65;
  const valueBadge = visible.value === null
    ? ''
    : `<g transform="translate(10 ${badgeY})"><rect width="62" height="22" rx="11" fill="#345ff6" opacity="0.92"></rect><text class="node-badge" x="8" y="16">v ${formatNumber(visible.value, 2)}</text></g>`;
  const gradBadge = visible.grad === null
    ? ''
    : `<g transform="translate(78 ${badgeY})"><rect width="62" height="22" rx="11" fill="#f0624d" opacity="0.92"></rect><text class="node-badge" x="7" y="16">∂ ${formatNumber(visible.grad, 2)}</text></g>`;

  return `
    <g transform="translate(${node.x - 75} ${node.y - 48})" style="filter:${glow}" data-graph-node="${node.id}" data-active="${visible.active}">
      <rect width="150" height="96" rx="24" fill="${fill}" stroke="${stroke}" stroke-width="${visible.active ? 3 : 2}"></rect>
      <text class="node-label" x="16" y="32">${node.label}</text>
      <text class="node-sub" x="16" y="51">${node.sub}</text>
      ${valueBadge}
      ${gradBadge}
    </g>
  `;
}

function renderGraphFigure() {
  const stage = state.graphStage;
  const stageMeta = GRAPH_STAGES[stage];
  const visibleState = graphVisibleState(stage);
  const direction = stageMeta.direction;

  const edgesMarkup = GRAPH_EDGES.map((edge) => {
    const active = stageMeta.activeEdges.includes(edge.id);
    const color = direction === 'Backward' && active ? '#f0624d' : active ? '#345ff6' : '#bfc7d1';
    return `<path d="${edgePath(edge)}" fill="none" stroke="${color}" stroke-width="${active ? 4 : 2.4}" stroke-linecap="round" opacity="${active ? 0.98 : 0.64}"></path>`;
  }).join('');

  const nodesMarkup = GRAPH_NODES.map((node) => nodeMarkup(node, visibleState[node.id], direction)).join('');

  els.graphSvg.innerHTML = `
    <defs>
      <linearGradient id="graphWash" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f8fbff"></stop>
        <stop offset="100%" stop-color="#fff7f3"></stop>
      </linearGradient>
    </defs>
    <rect x="18" y="18" width="1444" height="624" rx="30" fill="url(#graphWash)" stroke="#d7dde6"></rect>
    <text x="46" y="62" class="node-sub">单个正类样本：x = ${formatNumber(graphSnapshot.values.x)}，w = ${formatNumber(graphSnapshot.values.w)}，b = ${formatNumber(graphSnapshot.values.b)}</text>
    ${edgesMarkup}
    ${nodesMarkup}
  `;

  els.stageIndex.textContent = `${stage} / ${FINAL_STAGE}`;
  els.stageDirection.textContent = stageMeta.direction;
  els.stageFocus.textContent = stageMeta.focus;
  els.stageHeadline.textContent = stageMeta.headline(graphSnapshot);
  els.stageExplanation.innerHTML = stageMeta.explanation(graphSnapshot);
  renderTex(els.chainRuleMath, stageMeta.formula, true);
  els.stageScrubber.value = String(stage);

  renderNodeTable(visibleState);
  keepActiveGraphNodesInView();
}

function renderNodeTable(visibleState) {
  const disclosureWasOpen = Boolean(els.nodeTable.querySelector('.ledger-disclosure')?.open);
  const header = `
    <div class="ledger-row ledger-row--header">
      <div><strong>节点</strong><span>作用</span></div>
      <div><strong>值</strong><span>已缓存</span></div>
      <div><strong>梯度</strong><span>已接收</span></div>
    </div>
  `;

  const rowMarkup = (node, scope) => {
    const visible = visibleState[node.id];
    return `
      <div class="ledger-row ${visible.active ? 'ledger-row--active' : ''}" data-ledger-scope="${scope}" data-node-id="${node.id}">
        <div><strong>${node.label}</strong><span>${node.sub}</span></div>
        <div><strong>${formatNumber(visible.value, 3)}</strong><span>${visible.value === null ? 'pending' : 'cached'}</span></div>
        <div><strong>${formatNumber(visible.grad, 3)}</strong><span>${visible.grad === null ? 'pending' : 'ready'}</span></div>
      </div>
    `;
  };

  const previewNodes = [];
  const previewIds = new Set();
  const addPreview = (node) => {
    if (!node || previewIds.has(node.id) || previewNodes.length >= 5) return;
    previewIds.add(node.id);
    previewNodes.push(node);
  };

  GRAPH_NODES.filter((node) => visibleState[node.id].active).forEach(addPreview);
  GRAPH_NODES
    .filter((node) => visibleState[node.id].grad !== null)
    .sort((a, b) => b.backwardStep - a.backwardStep)
    .forEach(addPreview);
  GRAPH_NODES
    .filter((node) => visibleState[node.id].value !== null)
    .sort((a, b) => b.forwardStep - a.forwardStep)
    .forEach(addPreview);

  const previewRows = previewNodes.map((node) => rowMarkup(node, 'preview')).join('');
  const allRows = GRAPH_NODES.map((node) => rowMarkup(node, 'all')).join('');
  els.nodeTable.innerHTML = `
    <p class="ledger-caption">上下文中共 ${previewNodes.length} 个节点 · 活动节点优先</p>
    <div class="ledger-preview" aria-label="与当前阶段相关的节点">
      ${header}
      ${previewRows}
    </div>
    <details class="ledger-disclosure" ${disclosureWasOpen ? 'open' : ''}>
      <summary>全部 ${GRAPH_NODES.length} 个值与梯度</summary>
      <div class="ledger-all">
        ${header}
        ${allRows}
      </div>
    </details>
  `;
}

function keepActiveGraphNodesInView() {
  const surface = els.graphSvg.parentElement;
  if (!surface || surface.scrollWidth <= surface.clientWidth + 2) return;
  const activeNodes = GRAPH_NODES.filter((node) => GRAPH_STAGES[state.graphStage].activeNodes.includes(node.id));
  if (!activeNodes.length) return;
  const minX = Math.min(...activeNodes.map((node) => node.x - 90));
  const maxX = Math.max(...activeNodes.map((node) => node.x + 90));
  const viewBoxWidth = els.graphSvg.viewBox.baseVal.width || 1480;
  const scale = els.graphSvg.getBoundingClientRect().width / viewBoxWidth;
  const activeCenter = ((minX + maxX) / 2) * scale;
  const desired = activeCenter - surface.clientWidth / 2;
  surface.scrollLeft = Math.max(0, Math.min(surface.scrollWidth - surface.clientWidth, desired));
}

function moveGraphStage(nextStage) {
  state.graphStage = Math.max(0, Math.min(FINAL_STAGE, nextStage));
  renderGraphFigure();
}

function stepForwardGraph() {
  if (state.graphStage < FORWARD_STAGE_END) {
    moveGraphStage(state.graphStage + 1);
  }
}

function stepBackwardGraph() {
  if (state.graphStage < FORWARD_STAGE_END) {
    moveGraphStage(FORWARD_STAGE_END + 1);
    return;
  }
  if (state.graphStage < FINAL_STAGE) {
    moveGraphStage(state.graphStage + 1);
  }
}

function toggleAutoplay() {
  if (autoPlayHandle) {
    window.clearInterval(autoPlayHandle);
    autoPlayHandle = null;
    els.autoPlay.textContent = '自动播放';
    return;
  }
  if (state.graphStage >= FINAL_STAGE) {
    moveGraphStage(0);
  }
  els.autoPlay.textContent = 'Pause';
  autoPlayHandle = window.setInterval(() => {
    if (state.graphStage >= FINAL_STAGE) {
      window.clearInterval(autoPlayHandle);
      autoPlayHandle = null;
      els.autoPlay.textContent = '自动播放';
      return;
    }
    moveGraphStage(state.graphStage + 1);
  }, 1100);
}

function exportGraphStage() {
  const stage = state.graphStage;
  downloadJson(`导出文件 autograd-stage-${stage}.json`, createGraphExport(stage));
}

function exportGraphTimeline() {
  const timeline = Array.from({ length: FINAL_STAGE + 1 }, (_, stage) => createGraphExport(stage));
  downloadJson('autograd-graph-timeline.json', timeline);
}

function createGraphExport(stage) {
  const stageMeta = GRAPH_STAGES[stage];
  const visible = graphVisibleState(stage);
  return {
    stage,
    direction: stageMeta.direction,
    focus: stageMeta.focus,
    formula: stageMeta.formula,
    inputs: SINGLE_INPUT,
    nodes: GRAPH_NODES.map((node) => ({
      id: node.id,
      label: node.label,
      sub: node.sub,
      value: visible[node.id].value,
      grad: visible[node.id].grad,
      active: visible[node.id].active,
    })),
  };
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json（JSON 数据类型）' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderRules() {
  els.ruleChips.innerHTML = RULES.map((rule) => `
    <button type="button" class="rule-chip ${rule.id === state.selectedRule ? 'is-active' : ''}" data-rule-id="${rule.id}">${rule.label}</button>
  `).join('');

  els.ruleGrid.innerHTML = RULES.map((rule) => `
    <article class="rule-card ${rule.id === state.selectedRule ? 'is-active' : ''}" data-rule-id="${rule.id}">
      <h4>${rule.label}</h4>
      <p>${rule.summary}</p>
    </article>
  `).join('');

  const selected = RULES.find((rule) => rule.id === state.selectedRule) || RULES[0];
  els.ruleTitle.textContent = selected.label;
  els.ruleExplanation.textContent = selected.explanation;
  renderTex(els.ruleFormula, selected.tex, true);

  document.querySelectorAll('[data-rule-id]').forEach((element) => {
    element.addEventListener('click', () => {
      state.selectedRule = element.getAttribute('data-rule-id') || RULES[0].id;
      renderRules();
    });
  });
}

function modulePath(fromNode, toNode) {
  const startX = fromNode.x + fromNode.w / 2;
  const startY = fromNode.y;
  const endX = toNode.x - toNode.w / 2;
  const endY = toNode.y;
  const dx = endX - startX;
  return `M ${startX} ${startY} C ${startX + dx * 0.4} ${startY}, ${endX - dx * 0.3} ${endY}, ${endX} ${endY}`;
}

function renderModuleView() {
  const view = MODULE_VIEWS[state.moduleMode];
  els.modeChips.forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.mode === state.moduleMode);
  });

  const edges = view.edges.map(([fromId, toId]) => {
    const fromNode = view.nodes.find((node) => node.id === fromId);
    const toNode = view.nodes.find((node) => node.id === toId);
    return `<path d="${modulePath(fromNode, toNode)}" fill="none" stroke="#c5ced8" stroke-width="3" stroke-linecap="round"></path>`;
  }).join('');

  const nodes = view.nodes.map((node) => `
    <g transform="translate(${node.x - node.w / 2} ${node.y - node.h / 2})">
      <rect width="${node.w}" height="${node.h}" rx="22" fill="${node.fill}" stroke="#c8d2de" stroke-width="2"></rect>
      <text class="node-label" x="16" y="${node.h / 2 + 6}" style="font-size:${node.w > 150 ? 18 : 20}px">${node.label}</text>
    </g>
  `).join('');

  els.moduleSvg.innerHTML = `
    <rect x="18" y="18" width="1084" height="324" rx="28" fill="#fbfbfd" stroke="#dae1e9"></rect>
    ${edges}
    ${nodes}
  `;

  els.moduleHeadline.textContent = view.headline;
  els.moduleBody.textContent = view.body;
  els.moduleList.innerHTML = view.bullets.map((bullet) => `
    <div class="module-list__item">
      <strong>${bullet.title}</strong>
      <span>${bullet.text}</span>
    </div>
  `).join('');
}

function datasetButtonsMarkup() {
  return Object.entries(BATCH_DATASETS).map(([key, dataset]) => `
    <button type="button" class="dataset-chip ${state.batch.datasetKey === key ? 'is-active' : ''}" data-dataset="${key}">${dataset.label}</button>
  `).join('');
}

function syncBatchControls() {
  els.paramW.value = String(state.batch.w);
  els.paramB.value = String(state.batch.b);
  els.learningRate.value = String(state.batch.lr);
  els.paramWValue.textContent = formatNumber(state.batch.w, 2);
  els.paramBValue.textContent = formatNumber(state.batch.b, 2);
  els.learningRateInline.textContent = formatNumber(state.batch.lr, 2);
  els.learningRateValue.textContent = formatNumber(state.batch.lr, 2);
}

function computeBatchSnapshot() {
  const dataset = BATCH_DATASETS[state.batch.datasetKey];
  const rows = dataset.points.map((point) => {
    const z = state.batch.w * point.x + state.batch.b;
    const p = clampProbability(sigmoid(z));
    const loss = -(point.y * Math.log(p) + (1 - point.y) * Math.log(1 - p));
    const gradZ = p - point.y;
    return {
      ...point,
      z,
      p,
      loss,
      gradW: gradZ * point.x,
      gradB: gradZ,
    };
  });

  const meanLoss = rows.reduce((sum, row) => sum + row.loss, 0) / rows.length;
  const meanGradW = rows.reduce((sum, row) => sum + row.gradW, 0) / rows.length;
  const meanGradB = rows.reduce((sum, row) => sum + row.gradB, 0) / rows.length;

  return {
    dataset,
    rows,
    meanLoss,
    meanGradW,
    meanGradB,
    nextW: state.batch.w - state.batch.lr * meanGradW,
    nextB: state.batch.b - state.batch.lr * meanGradB,
  };
}

function renderBatchSvg(snapshot) {
  const xScale = (value) => 90 + ((value + 3) / 6) * 610;
  const yScale = (value) => 360 - value * 260;
  const curvePoints = Array.from({ length: 120 }, (_, index) => {
    const x = -3 + (index / 119) * 6;
    const y = sigmoid(state.batch.w * x + state.batch.b);
    return `${index === 0 ? 'M' : 'L'} ${xScale(x)} ${yScale(y)}`;
  }).join(' ');

  const guides = [0, 0.5, 1].map((y) => `
    <g>
      <line x1="90" y1="${yScale(y)}" x2="700" y2="${yScale(y)}" stroke="#e3e8ee" stroke-width="1.5" stroke-dasharray="5 8"></line>
      <text x="52" y="${yScale(y) + 5}" class="node-sub batch-axis-label（坐标轴标签）">${y.toFixed(1)}</text>
    </g>
  `).join('');

  const xTicks = [-2, -1, 0, 1, 2].map((x) => `
    <g>
      <line x1="${xScale(x)}" y1="360" x2="${xScale(x)}" y2="372" stroke="#aeb8c2" stroke-width="1.4"></line>
      <text x="${xScale(x) - 8}" y="394" class="node-sub batch-axis-label（坐标轴标签）">${x}</text>
    </g>
  `).join('');

  const examples = snapshot.rows.map((row, index) => {
    const baseY = yScale(row.y);
    const predY = yScale(row.p);
    const x = xScale(row.x);
    const color = row.y === 1 ? '#0c7f78' : '#f0624d';
    const labelX = row.x > 1.5 ? x - 82 : x + 12;
    return `
      <g>
        <line x1="${x}" y1="${baseY}" x2="${x}" y2="${predY}" stroke="${color}" stroke-width="2.4" opacity="0.5"></line>
        <circle cx="${x}" cy="${predY}" r="10" fill="#ffffff" stroke="${color}" stroke-width="3"></circle>
        <circle cx="${x}" cy="${baseY}" r="6" fill="${color}" opacity="0.85"></circle>
        <text x="${labelX}" y="${Math.min(baseY, predY) - 12 - index * 2}" class="node-sub batch-point-label（数据点标签）">${row.name}: p=${formatNumber(row.p, 2)}</text>
      </g>
    `;
  }).join('');

  const paramsTag = `w = ${formatNumber(state.batch.w, 2)}, b = ${formatNumber(state.batch.b, 2)}`;

  els.batchSvg.innerHTML = `
    <rect x="18" y="18" width="724" height="394" rx="28" fill="#fbfbfd" stroke="#dae1e9"></rect>
    <text x="42" y="48" class="node-sub batch-chart-title（图表标题）">${snapshot.dataset.label} • ${paramsTag}</text>
    <text x="42" y="76" class="node-sub batch-chart-note（图表注释）">圆点：标签 · 圆环：预测值 · 连线：误差</text>
    ${guides}
    <line x1="90" y1="360" x2="700" y2="360" stroke="#aeb8c2" stroke-width="2"></line>
    ${xTicks}
    <path d="${curvePoints}" fill="none" stroke="#345ff6" stroke-width="5" stroke-linecap="round"></path>
    ${examples}
    <text x="676" y="394" class="node-sub batch-axis-label（坐标轴标签）">x</text>
  `;
}

function batchNarrative(snapshot) {
  const directionW = snapshot.meanGradW > 0 ? 'downward' : 'upward';
  const directionB = snapshot.meanGradB > 0 ? 'downward' : 'upward';
  return `${snapshot.dataset.description} 当前批量梯度希望把 <code>w</code> 移动 ${directionW}，把 <code>b</code> 移动 ${directionB}。经过一步之后，参数将变为 <code>w = ${formatNumber(snapshot.nextW, 2)}</code> 与 <code>b = ${formatNumber(snapshot.nextB, 2)}</code>。`;
}

function renderBatchFigure() {
  els.datasetSwitcher.innerHTML = datasetButtonsMarkup();
  syncBatchControls();
  const snapshot = computeBatchSnapshot();

  els.meanLoss.textContent = formatNumber(snapshot.meanLoss, 3);
  els.gradW.textContent = formatSigned(snapshot.meanGradW, 3);
  els.gradB.textContent = formatSigned(snapshot.meanGradB, 3);
  els.batchNarrative.innerHTML = batchNarrative(snapshot);

  els.exampleTableBody.innerHTML = snapshot.rows.map((row) => `
    <tr>
      <td>${row.name}</td>
      <td>${formatNumber(row.x, 2)}</td>
      <td>${row.y}</td>
      <td>${formatNumber(row.p, 3)}</td>
      <td>${formatNumber(row.loss, 3)}</td>
      <td>${formatSigned(row.gradW, 3)}</td>
    </tr>
  `).join('');

  renderBatchSvg(snapshot);

  document.querySelectorAll('[data-dataset]').forEach((button) => {
    button.addEventListener('click', () => {
      const datasetKey = button.getAttribute('data-dataset');
      if (!datasetKey || !BATCH_DATASETS[datasetKey]) return;
      state.batch.datasetKey = datasetKey;
      state.batch.w = BATCH_DATASETS[datasetKey].defaults.w;
      state.batch.b = BATCH_DATASETS[datasetKey].defaults.b;
      renderBatchFigure();
    });
  });
}

function applyBatchUpdate() {
  const snapshot = computeBatchSnapshot();
  state.batch.w = snapshot.nextW;
  state.batch.b = snapshot.nextB;
  renderBatchFigure();
}

function resetBatchParams() {
  const defaults = BATCH_DATASETS[state.batch.datasetKey].defaults;
  state.batch.w = defaults.w;
  state.batch.b = defaults.b;
  renderBatchFigure();
}

function exportBatchSnapshot() {
  const snapshot = computeBatchSnapshot();
  downloadJson('autograd-batch-snapshot.json', {
    dataset: state.batch.datasetKey,
    params: {
      w: state.batch.w,
      b: state.batch.b,
      lr: state.batch.lr,
    },
    summary: {
      meanLoss: snapshot.meanLoss,
      meanGradW: snapshot.meanGradW,
      meanGradB: snapshot.meanGradB,
      nextW: snapshot.nextW,
      nextB: snapshot.nextB,
    },
    rows: snapshot.rows,
  });
}

function updateProgress() {
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
  const progress = scrollHeight <= 0 ? 0 : (window.scrollY / scrollHeight) * 100;
  els.progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
}

function updateToc() {
  let bestId = els.sections[0]?.id;
  let bestDistance = Number.POSITIVE_INFINITY;
  els.sections.forEach((section) => {
    const distance = Math.abs(section.getBoundingClientRect().top - 120);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestId = section.id;
    }
  });
  els.tocLinks.forEach((link) => {
    const active = link.getAttribute('href') === `#${bestId}`;
    link.classList.toggle('is-active', active);
  });
}

function bindEvents() {
  els.stageScrubber.addEventListener('input', (event) => {
    moveGraphStage(Number(event.target.value));
  });
  els.resetGraph.addEventListener('click', () => moveGraphStage(0));
  els.stepForward.addEventListener('click', stepForwardGraph);
  els.stepBackward.addEventListener('click', stepBackwardGraph);
  els.autoPlay.addEventListener('click', toggleAutoplay);
  els.exportStage.addEventListener('click', exportGraphStage);
  els.exportTimeline.addEventListener('click', exportGraphTimeline);

  els.modeChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      state.moduleMode = chip.dataset.mode || 'micro';
      renderModuleView();
    });
  });

  els.paramW.addEventListener('input', (event) => {
    state.batch.w = Number(event.target.value);
    renderBatchFigure();
  });
  els.paramB.addEventListener('input', (event) => {
    state.batch.b = Number(event.target.value);
    renderBatchFigure();
  });
  els.learningRate.addEventListener('input', (event) => {
    state.batch.lr = Number(event.target.value);
    renderBatchFigure();
  });
  els.resetBatch.addEventListener('click', resetBatchParams);
  els.applyBatchStep.addEventListener('click', applyBatchUpdate);
  els.exportBatch.addEventListener('click', exportBatchSnapshot);

  window.addEventListener('scroll', () => {
    updateProgress();
    updateToc();
  }, { passive: true });
  window.addEventListener('resize', () => {
    updateToc();
    keepActiveGraphNodesInView();
  });
}

function exposeApi() {
  window.AutogradExplainer = {
    exportGraphStage: () => createGraphExport(state.graphStage),
    exportGraphTimeline: () => Array.from({ length: FINAL_STAGE + 1 }, (_, stage) => createGraphExport(stage)),
    exportBatchSnapshot: () => computeBatchSnapshot(),
    setGraphStage: moveGraphStage,
  };
}

function init() {
  renderStaticMath();
  renderRules();
  renderGraphFigure();
  renderModuleView();
  renderBatchFigure();
  bindEvents();
  updateProgress();
  updateToc();
  exposeApi();
}

init();
