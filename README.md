[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=for-the-badge)](https://github.com/hacs/integration)

# mollier-hx-card
Mollier hx diagram card for home assistant

TODO: check HACS requirements
https://hacs.xyz/docs/publish/start/

TODO: create readme, example here
https://github.com/matiassingers/awesome-readme


A custom dashboard card for Home Assistant that renders a Mollier h-x (enthalpy vs. humidity ratio) diagram using real-time temperature and humidity sensor data. Ideal for visualizing indoor climate and psychrometric conditions.

![Screenshot](https://your-screenshot-url.com)

---

## Installation via HACS

1. Open Home Assistant.
2. Go to **HACS → Frontend → Custom Repositories**.
3. Add this repository as a **Lovelace** type repo:
   ```
   https://github.com/yourusername/mollier-hx-card
   ```
4. Install **Mollier HX Card** from the list.
5. Add the resource:
   ```yaml
   url: /hacsfiles/mollier-hx-card/mollier-hx-card.js
   type: module
   ```

---

## 🧾 Card Configuration

```yaml
type: custom:mollier-hx-card
temperature: sensor.indoor_temperature
humidity: sensor.indoor_humidity
header: "Indoor Climate"
```

### 🔧 Options

| Name         | Type   | Required | Description                              |
|--------------|--------|----------|------------------------------------------|
| `temperature`| string | ✅       | Entity ID of temperature sensor          |
| `humidity`   | string | ✅       | Entity ID of humidity sensor             |
| `header`     | string | ❌       | Card header (optional title)             |

---

## 📊 Features

- 📈 Real-time Mollier h-x diagram
- 🧠 Psychrometric data visualization
- 🧩 UI editor support (no YAML required)
- 🌡️ Works with any `sensor.*` providing temperature & humidity
- 🚀 Fast rendering with D3.js
- 💡 Ideal for HVAC, energy optimization, and smart home comfort monitoring

---
## License

[MIT](LICENSE)

---

## 🤝 Contributions

PRs and feedback welcome! Feel free to:
- Submit issues
- Suggest improvements
- Fork and build your own variant

---

## 🔗 Links

- 💡 [What is a Mollier Diagram? (Wikipedia)](https://en.wikipedia.org/wiki/Enthalpy–entropy_chart)
- 🧠 [Home Assistant Custom Cards Guide](https://developers.home-assistant.io/docs/frontend/custom-ui/lovelace-custom-card/)
