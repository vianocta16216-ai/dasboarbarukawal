/**
 * Sinkronisasi perubahan master KK PM SPIP ke workbook OPD.
 * Pasang sebagai Apps Script yang terikat (bound) pada Google Sheets master PM.
 * Isi Script Properties sebelum menjalankan setupKawalSpipMasterSyncTrigger().
 */
function setupKawalSpipMasterSyncTrigger() {
  var properties = PropertiesService.getScriptProperties();
  var url = String(properties.getProperty('KAWAL_SPIP_WEBHOOK_URL') || '').trim();
  var secret = String(properties.getProperty('KAWAL_SPIP_SYNC_SECRET') || '').trim();
  if (!url || !secret || secret.length < 32) {
    throw new Error('Isi Script Properties KAWAL_SPIP_WEBHOOK_URL dan KAWAL_SPIP_SYNC_SECRET (minimal 32 karakter) terlebih dahulu.');
  }
  var spreadsheetId = String(properties.getProperty('KAWAL_SPIP_MASTER_SPREADSHEET_ID') || '').trim();
  if (spreadsheetId && SpreadsheetApp.getActiveSpreadsheet().getId() !== spreadsheetId) {
    throw new Error('Script ini terpasang pada spreadsheet yang berbeda dari KAWAL_SPIP_MASTER_SPREADSHEET_ID.');
  }
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'notifyKawalSpipMasterChanged') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger('notifyKawalSpipMasterChanged')
    .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
    .onEdit()
    .create();
  return 'Trigger sinkronisasi Kawal SPIP berhasil dipasang.';
}

function notifyKawalSpipMasterChanged(event) {
  if (!event || !event.range) return;
  var relevantSheets = ['KK3.1', 'KK3.2', 'KK3.3', 'KK3.4'];
  var sheetName = event.range.getSheet().getName();
  if (relevantSheets.indexOf(sheetName) === -1) return;

  var properties = PropertiesService.getScriptProperties();
  var url = String(properties.getProperty('KAWAL_SPIP_WEBHOOK_URL') || '').trim();
  var secret = String(properties.getProperty('KAWAL_SPIP_SYNC_SECRET') || '').trim();
  var year = String(properties.getProperty('KAWAL_SPIP_YEAR') || new Date().getFullYear()).trim();
  if (!url || !secret || secret.length < 32) {
    console.error('Kawal SPIP master sync belum dikonfigurasi di Script Properties.');
    return;
  }
  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ action: 'syncKkPmMasterNow', year: year, secret: secret }),
    muteHttpExceptions: true,
    followRedirects: true
  });
  var status = response.getResponseCode();
  if (status < 200 || status >= 300) {
    console.error('Kawal SPIP master sync HTTP ' + status + ': ' + response.getContentText().slice(0, 1000));
  } else {
    console.log('Kawal SPIP master sync dipanggil: ' + response.getContentText().slice(0, 1000));
  }
}
