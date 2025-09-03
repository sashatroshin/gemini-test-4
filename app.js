let config = {};

async function loadConfig() {
  try {
    const response = await fetch('config.json');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    config = await response.json();
    console.log('Config loaded:', config);
    // Дальнейшая инициализация приложения, использующая конфиг
  } catch (error) {
    console.error('Could not load config.json:', error);
    alert('Ошибка: Не удалось загрузить файл конфигурации. Приложение не может быть запущено.');
  }
}

document.addEventListener('DOMContentLoaded', loadConfig);
