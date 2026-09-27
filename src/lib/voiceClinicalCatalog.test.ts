import { describe, expect, it } from "vitest";
import { matchVoiceDevice, voiceDeviceSuggestions } from "./voiceClinicalCatalog";

describe("catálogo de intenção para ditado clínico", () => {
  it("mapeia IOT para a ação clínica e para o dispositivo persistido", () => {
    const match = matchVoiceDevice("adicionar IOT", true);
    expect(match?.device.code).toBe("TOT");
    expect(match?.clinicalName).toBe("Intubação orotraqueal (IOT)");
    expect(match?.confidence).toBe("exact");
  });

  it("trata IT como hipótese de IOT somente no contexto de invasões", () => {
    const match = matchVoiceDevice("adicionar IT", true);
    expect(match?.device.code).toBe("TOT");
    expect(match?.confidence).toBe("inferred");
  });

  it("não transforma a sigla IT em TOT por similaridade textual", () => {
    expect(matchVoiceDevice("adicionar IT", false)).toBeUndefined();
  });

  it("mantém sugestões dentro do catálogo de invasões", () => {
    const options = voiceDeviceSuggestions("adicionar dreno toracico");
    expect(options[0]?.device.code).toBe("DRT");
  });
});
