let CELL_PROPERTIES = {};
let PROPERTY_CONFIG = {};

const FUNCTION_MAP = {
  'BL': { type: 'blood', icon: '❤️', bgColor: '#ffebee', direction: null },
  'FF': { type: 'fastforward', icon: '➡️', bgColor: '#e8f5e9', direction: 'forward' },
  'FB': { type: 'fastback', icon: '➡️', bgColor: '#d7ccc8', direction: 'backward' },
  'FLF': { type: 'flashforward', icon: '🚀', bgColor: '#e1f5fe', direction: 'forward' },
  'FLB': { type: 'flashback', icon: '🚀', bgColor: '#eceff1', direction: 'backward' },
  'BB': { type: 'bomb', icon: '💣', bgColor: '#fce4ec', direction: null },
  'DDD': { type: 'diediedie', icon: '💀', bgColor: '#333', direction: null },
  'UND': { type: 'undie', icon: '🛡️', bgColor: '#e0f7fa', direction: null },
  'CR': { type: 'changeorder', icon: '🔀', bgColor: '#fce4ec', direction: null },
  'BH': { type: 'blackhole', icon: '🕳️', bgColor: '#666666', direction: null },
  'TO': { type: 'goto', icon: '🌀', bgColor: '#fff3e0', direction: null },
  'GST': { type: 'ghost', icon: '👻', bgColor: '#f3e5f5', direction: null },
  'P': { type: 'pause', icon: '⏸️', bgColor: '#fff9c4', direction: null }
};

function parseCSV(csv) {
  const lines = csv.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const result = {};
  
  const hasChineseName = headers.includes('中文名称');
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ? values[index].trim() : '';
    });
    
    const cellNumber = parseInt(row['格子']);
    if (!isNaN(cellNumber) && row['功能']) {
      const func = row['功能'].trim();
      const variable = row['变量'] ? row['变量'].trim() : '';
      const funcInfo = FUNCTION_MAP[func];
      
      if (funcInfo) {
        let label = funcInfo.icon;
        let value = 0;
        let rawValue = variable;
        
        if (variable && variable !== 'X') {
          if (variable.startsWith('#')) {
            value = parseInt(variable.substring(1));
          } else {
            const numPart = variable.replace(/[^0-9-]/g, '');
            value = numPart ? parseInt(numPart) : 0;
          }
        }

        if (func === 'BL') {
          const heartIcon = value < 0 ? '🖤' : '❤️';
          const displayValue = Math.abs(value);
          label = displayValue > 0 ? `${heartIcon}${displayValue}` : heartIcon;
        } else if (variable && variable !== 'X') {
          const numPart = variable.replace(/[^0-9]/g, '');
          if (numPart) {
            label = `${funcInfo.icon}${numPart}`;
          }
        }
        const displayName = hasChineseName ? (row['中文名称'] || funcInfo.icon) : (row['规则'] || funcInfo.icon);
        const displayRule = hasChineseName ? (row['规则'] || '') : '';
        
        result[cellNumber] = {
          label: label,
          type: funcInfo.type,
          value: value,
          rawValue: rawValue,
          color: getColorForType(funcInfo.type),
          displayName: displayName,
          displayRule: displayRule,
          englishName: row['英文全称'] || '',
          direction: funcInfo.direction
        };
      }
    }
  }
  
  return result;
}

function assignRandomBlackholes(properties, totalCells = (CONFIG && CONFIG.ROWS && CONFIG.COLS) ? CONFIG.ROWS * CONFIG.COLS : 64) {
  const safeProperties = {};
  const occupiedCells = new Set();

  Object.keys(properties).forEach((cellNumber) => {
    const parsedCellNumber = parseInt(cellNumber, 10);
    const property = properties[cellNumber];

    if (property && property.type === 'blackhole') {
      return;
    }

    safeProperties[parsedCellNumber] = property;
    occupiedCells.add(parsedCellNumber);
  });

  const candidateCells = [];
  for (let cellNumber = 2; cellNumber <= totalCells - 1; cellNumber++) {
    if (!occupiedCells.has(cellNumber)) {
      candidateCells.push(cellNumber);
    }
  }

  const selectedCells = [];
  while (selectedCells.length < 6 && candidateCells.length > 0) {
    const randomIndex = Math.floor(Math.random() * candidateCells.length);
    const selectedCell = candidateCells.splice(randomIndex, 1)[0];
    selectedCells.push(selectedCell);
  }

  selectedCells.forEach((cellNumber, index) => {
    const blackholeInfo = FUNCTION_MAP['BH'];
    const blackholeConfig = PROPERTY_CONFIG.blackhole || {};
    safeProperties[cellNumber] = {
      label: `${blackholeInfo.icon}${index + 1}`,
      type: blackholeInfo.type,
      value: index + 1,
      rawValue: String(index + 1),
      color: getColorForType(blackholeInfo.type),
      displayName: blackholeConfig.name || '黑洞',
      displayRule: blackholeConfig.description || '',
      englishName: 'Blackhole',
      direction: blackholeInfo.direction
    };
  });

  return safeProperties;
}

function getColorForType(type) {
  const colors = {
    blood: '#e74c3c',
    fastforward: '#27ae60',
    fastback: '#795548',
    flashforward: '#3498db',
    flashback: '#607d8b',
    bomb: '#9b59b6',
    diediedie: '#000000',
    undie: '#1abc9c',
    changeorder: '#e91e63',
    blackhole: '#666666',
    goto: '#f39c12',
    ghost: '#9c27b0'
  };
  return colors[type] || '#666';
}

PROPERTY_CONFIG = {
  blood: { name: '血量变化', icon: '❤️', bgColor: '#ffebee', description: 'x为变化量，正值为加血，负值为减血' },
  fastforward: { name: '加速前进', icon: '⚡', bgColor: '#e8f5e9', description: 'x为变化量，只有正值，为额外向前移动的步数' },
  fastback: { name: '加速后退', icon: '⬅️', bgColor: '#d7ccc8', description: 'x为变化量，只有正值，为额外向后移动的步数' },
  flashforward: { name: '超速前进', icon: '🚀', bgColor: '#e1f5fe', description: 'x为变化量，踩到后再向前移动当前掷骰子数量x倍的格子' },
  flashback: { name: '超速后退', icon: '🔮', bgColor: '#eceff1', description: 'x为变化量，踩到后再向后移动当前掷骰子数量x倍的格子' },
  bomb: { name: '炸弹爆炸', icon: '💣', bgColor: '#fce4ec', description: 'x为爆炸范围，以格子为中心，前后各x格范围内的所有玩家受到伤害' },
  diediedie: { name: '死亡陷阱', icon: '💀', bgColor: '#333', description: '无变量，玩家踩到直接死亡' },
  undie: { name: '不死守护', icon: '🛡️', bgColor: '#e0f7fa', description: 'x为不死回合数，回合数内踩到DDD可不死' },
  changeorder: { name: '顺序变换', icon: '🔀', bgColor: '#fce4ec', description: '无变量，掷骰子顺序反转' },
  blackhole: { name: '黑洞', icon: '🕳️', bgColor: '#666666', description: 'x为黑洞编号，踩到后移动到当前骰子数对应的黑洞' },
  goto: { name: '格子跳转', icon: '🌀', bgColor: '#fff3e0', description: 'x为格子编号，直接跳转到对应格子' },
  ghost: { name: '幽灵', icon: '👻', bgColor: '#f3e5f5', description: '踩到后可召唤幽灵' },
  pause: { name: '暂停', icon: '⏸️', bgColor: '#fff9c4', description: 'x为暂停回合数，玩家将跳过x个回合' }
};

let currentMapFile = 'grid.csv';

async function loadGridCSV(filePath = 'grid.csv') {
  try {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load ${filePath}`);
    }
    const csv = await response.text();
    const parsedProperties = parseCSV(csv);
    CELL_PROPERTIES = assignRandomBlackholes(parsedProperties);
    currentMapFile = filePath;
    return CELL_PROPERTIES;
  } catch (error) {
    console.error(`Error loading ${filePath}:`, error);
    CELL_PROPERTIES = {};
    return CELL_PROPERTIES;
  }
}

async function loadMapFromFile(filePath) {
  return loadGridCSV(filePath);
}

function getCurrentMapFile() {
  return currentMapFile;
}