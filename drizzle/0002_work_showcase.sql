ALTER TABLE works ADD COLUMN showcase_url TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN showcase_type TEXT NOT NULL DEFAULT 'image';
ALTER TABLE works ADD COLUMN showcase_layout TEXT NOT NULL DEFAULT 'standard';
ALTER TABLE works ADD COLUMN showcase_highlight TEXT NOT NULL DEFAULT '';
ALTER TABLE works ADD COLUMN showcase_cta TEXT NOT NULL DEFAULT '查看项目';

UPDATE works
SET showcase_url = '/kolpilot-project-panorama.png',
    showcase_type = 'image',
    showcase_layout = 'wide',
    showcase_highlight = '完成可点击 MVP、13 项端到端验收、完整人机边界设计。',
    showcase_cta = '查看项目'
WHERE slug = 'kolpilot-ai-creator-decision';

UPDATE works SET showcase_layout = 'portrait'
WHERE slug = 'agent-operations-system';

UPDATE works SET showcase_layout = 'standard'
WHERE slug = 'knowledge-synthesis-engine';