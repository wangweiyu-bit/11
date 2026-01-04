// 药品索引系统 - 主程序

// GitHub 配置 - 请替换为你的信息
const GITHUB_CONFIG = {
    owner: 'YOUR_GITHUB_USERNAME',        // 你的 GitHub 用户名
    repo: 'YOUR_REPO_NAME',               // 你的仓库名
    token: 'YOUR_GITHUB_TOKEN',           // GitHub Personal Access Token
    dataFile: 'medicines.json',           // 数据文件名
    branch: 'main'                        // 分支名
};

// 用户凭证配置
const CREDENTIALS = {
    pharmacist: {
        username: 'pharmacist',
        password: 'pharma2024',
        role: 'pharmacist'
    },
    nurse: {
        username: 'nurse',
        password: 'nurse2024',
        role: 'nurse'
    }
};

// 使用 localStorage 作为本地缓存
const STORAGE_KEY = 'medicineDatabase';
const SHA_KEY = 'fileSHA';

// 当前登录状态
let currentUser = null;
let selectedRole = 'pharmacist';
let fileSHA = null; // GitHub 文件的 SHA 值

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    // 定期从 GitHub 同步数据（每30秒）
    setInterval(syncFromGitHub, 30000);
});

function initializeApp() {
    // 检查是否已登录
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showPanel(currentUser.role);
    } else {
        showLoginPage();
    }

    // 角色选择按钮
    document.querySelectorAll('.role-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            selectedRole = this.dataset.role;
        });
    });

    // 登录表单
    document.getElementById('loginForm').addEventListener('submit', handleLogin);

    // 药师端上传表单
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);

    // 图片预览
    document.getElementById('medicineImage').addEventListener('change', handleImagePreview);

    // 护士端搜索
    document.getElementById('searchInput').addEventListener('input', searchMedicine);
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchMedicine();
        }
    });
}

// 显示登录页面
function showLoginPage() {
    document.getElementById('loginPage').style.display = 'block';
    document.getElementById('pharmacistPanel').style.display = 'none';
    document.getElementById('nursePanel').style.display = 'none';
}

// 处理登录
function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('loginError');

    // 验证凭证
    const credential = CREDENTIALS[selectedRole];
    
    if (username === credential.username && password === credential.password) {
        currentUser = {
            username: username,
            role: selectedRole
        };
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        errorMsg.style.display = 'none';
        showPanel(selectedRole);
    } else {
        errorMsg.textContent = '用户名或密码错误！';
        errorMsg.style.display = 'block';
    }
}

// 显示对应面板
async function showPanel(role) {
    document.getElementById('loginPage').style.display = 'none';
    
    // 先从 GitHub 同步最新数据
    await syncFromGitHub();
    
    if (role === 'pharmacist') {
        document.getElementById('pharmacistPanel').style.display = 'block';
        document.getElementById('nursePanel').style.display = 'none';
        loadMedicineList();
    } else {
        document.getElementById('pharmacistPanel').style.display = 'none';
        document.getElementById('nursePanel').style.display = 'block';
        loadNurseView();
    }
}

// 退出登录
function logout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    document.getElementById('loginForm').reset();
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    showLoginPage();
}

// 图片预览
function handleImagePreview(e) {
    const file = e.target.files[0];
    const preview = document.getElementById('imagePreview');
    const fileName = document.getElementById('fileName');
    
    if (file) {
        fileName.textContent = file.name;
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.src = e.target.result;
            preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

// 处理药品上传
function handleUpload(e) {
    e.preventDefault();
    
    const name = document.getElementById('medicineName').value.trim();
    const imageFile = document.getElementById('medicineImage').files[0];
    
    if (!name || !imageFile) {
        alert('请填写完整信息！');
        return;
    }

    // 读取图片并转换为 Base64
    const reader = new FileReader();
    reader.onload = async function(e) {
        const medicine = {
            id: Date.now(),
            name: name,
            image: e.target.result,
            uploadDate: new Date().toISOString()
        };

        // 保存到数据库
        await saveMedicine(medicine);

        // 重置表单
        document.getElementById('uploadForm').reset();
        document.getElementById('imagePreview').style.display = 'none';
        document.getElementById('fileName').textContent = '';

        // 刷新列表
        loadMedicineList();

        alert('药品添加成功！');
    };
    reader.readAsDataURL(imageFile);
}

// 保存药品到数据库（同时保存到 GitHub）
async function saveMedicine(medicine) {
    const medicines = getMedicines();
    medicines.push(medicine);
    
    // 保存到本地缓存
    localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
    
    // 同步到 GitHub
    await syncToGitHub(medicines);
}

// 获取所有药品
function getMedicines() {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
}

// 从 GitHub 读取数据
async function syncFromGitHub() {
    if (!isGitHubConfigured()) {
        return;
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}`;
        
        const response = await fetch(url, {
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            fileSHA = data.sha;
            localStorage.setItem(SHA_KEY, fileSHA);
            
            // 解码 Base64 内容
            const content = JSON.parse(atob(data.content));
            localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
            
            console.log('✅ 已从 GitHub 同步最新数据');
            
            // 如果当前在药师或护士面板，刷新显示
            if (currentUser) {
                if (currentUser.role === 'pharmacist') {
                    loadMedicineList();
                } else {
                    searchMedicine();
                }
            }
        } else if (response.status === 404) {
            // 文件不存在，创建初始文件
            console.log('GitHub 上没有数据文件，将创建新文件');
            await syncToGitHub([]);
        }
    } catch (error) {
        console.log('从 GitHub 同步失败:', error.message);
    }
}

// 保存数据到 GitHub
async function syncToGitHub(medicines) {
    if (!isGitHubConfigured()) {
        console.log('GitHub 未配置，仅保存到本地');
        return;
    }

    try {
        const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${GITHUB_CONFIG.dataFile}`;
        
        // 获取当前文件的 SHA（如果存在）
        if (!fileSHA) {
            fileSHA = localStorage.getItem(SHA_KEY);
        }
        
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(medicines, null, 2))));
        
        const body = {
            message: `更新药品数据 - ${new Date().toLocaleString('zh-CN')}`,
            content: content,
            branch: GITHUB_CONFIG.branch
        };
        
        if (fileSHA) {
            body.sha = fileSHA;
        }

        const response = await fetch(url, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_CONFIG.token}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const data = await response.json();
            fileSHA = data.content.sha;
            localStorage.setItem(SHA_KEY, fileSHA);
            console.log('✅ 数据已同步到 GitHub');
        } else {
            const error = await response.json();
            console.error('同步到 GitHub 失败:', error.message);
        }
    } catch (error) {
        console.error('同步到 GitHub 出错:', error.message);
    }
}

// 检查 GitHub 是否已配置
function isGitHubConfigured() {
    return GITHUB_CONFIG.owner !== 'YOUR_GITHUB_USERNAME' && 
           GITHUB_CONFIG.repo !== 'YOUR_REPO_NAME' && 
           GITHUB_CONFIG.token !== 'YOUR_GITHUB_TOKEN';
}

// 删除药品
async function deleteMedicine(id) {
    if (confirm('确定要删除这个药品吗？')) {
        let medicines = getMedicines();
        medicines = medicines.filter(m => m.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(medicines));
        
        // 同步到 GitHub
        await syncToGitHub(medicines);
        
        loadMedicineList();
    }
}

// 加载药品列表（药师端）
function loadMedicineList() {
    const medicines = getMedicines();
    const container = document.getElementById('medicineList');
    const countElement = document.getElementById('medicineCount');
    
    countElement.textContent = medicines.length;
    
    if (medicines.length === 0) {
        container.innerHTML = '<div class="no-results">暂无药品数据，请添加药品</div>';
        return;
    }

    container.innerHTML = medicines.map(medicine => `
        <div class="medicine-card">
            <img src="${medicine.image}" alt="${medicine.name}" class="medicine-image">
            <div class="medicine-info">
                <div class="medicine-name">${medicine.name}</div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">
                    添加时间: ${new Date(medicine.uploadDate).toLocaleDateString('zh-CN')}
                </div>
                <div class="medicine-actions">
                    <button class="delete-btn" onclick="deleteMedicine(${medicine.id})">删除</button>
                </div>
            </div>
        </div>
    `).join('');
}

// 加载护士端视图
function loadNurseView() {
    searchMedicine();
}

// 搜索药品
function searchMedicine() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const medicines = getMedicines();
    const container = document.getElementById('nurseSearchResults');
    
    let filteredMedicines = medicines;
    
    if (searchTerm) {
        filteredMedicines = medicines.filter(m => 
            m.name.toLowerCase().includes(searchTerm)
        );
    }

    if (filteredMedicines.length === 0) {
        container.innerHTML = '<div class="no-results">😔 未找到相关药品</div>';
        return;
    }

    container.innerHTML = filteredMedicines.map(medicine => `
        <div class="medicine-card">
            <img src="${medicine.image}" alt="${medicine.name}" class="medicine-image">
            <div class="medicine-info">
                <div class="medicine-name">${medicine.name}</div>
                <div style="font-size: 12px; color: #999; margin-top: 5px;">
                    添加时间: ${new Date(medicine.uploadDate).toLocaleDateString('zh-CN')}
                </div>
            </div>
        </div>
    `).join('');
}
