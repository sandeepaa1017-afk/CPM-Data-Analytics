package com.cpm.employee.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Warning as WarningIcon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.navigation.NavHostController
import com.cpm.employee.EmployeeUiState
import com.cpm.employee.navigation.EmployeeRoutes
import com.cpm.employee.ui.components.EmployeeScaffold
import com.cpm.employee.ui.components.IconBadge
import com.cpm.employee.ui.components.LabelValueRow
import com.cpm.employee.ui.components.SectionTitle
import com.cpm.employee.ui.components.SurfaceCard
import com.cpm.employee.ui.theme.BrandCyan
import com.cpm.employee.ui.theme.BrandNavy
import com.cpm.employee.ui.theme.Error
import com.cpm.employee.ui.theme.PaleBlue
import com.cpm.employee.ui.theme.Success
import com.cpm.employee.ui.theme.TextSecondary
import com.cpm.employee.ui.theme.Warning

@Composable
fun SyncScreen(
    state: EmployeeUiState,
    onManageCallLogSettings: () -> Unit,
    navController: NavHostController
) {
    EmployeeScaffold(
        title = "Sync status",
        navController = navController,
        selectedRoute = EmployeeRoutes.SYNC
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                SurfaceCard {
                    Column(
                        modifier = Modifier.fillMaxWidth().padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        IconBadge(Icons.Default.Refresh, BrandNavy, PaleBlue, size = 58)
                        Spacer(Modifier.height(12.dp))
                        Text(
                            if (state.isSyncing) "Syncing records" else "Sync is ready",
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            "Management starts sync remotely. Your phone must be online.",
                            color = TextSecondary,
                            modifier = Modifier.padding(top = 4.dp)
                        )
                        if (state.isSyncing) {
                            LinearProgressIndicator(
                                modifier = Modifier.fillMaxWidth().padding(top = 18.dp),
                                color = BrandCyan
                            )
                        }
                        if (!state.callLogConsentAccepted || !state.callLogPermissionGranted) {
                            TextButton(
                                onClick = onManageCallLogSettings,
                                modifier = Modifier.padding(top = 8.dp)
                            ) {
                                Text("Review call-log consent and permission")
                            }
                        }
                    }
                }
            }
            if (state.syncMessage != null) {
                item {
                    SurfaceCard {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(15.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            val tint = if (state.syncError) Error else Success
                            IconBadge(
                                if (state.syncError) Icons.Default.WarningIcon else Icons.Default.CheckCircle,
                                tint,
                                tint.copy(alpha = 0.1f),
                                size = 38
                            )
                            Text(
                                state.syncMessage,
                                modifier = Modifier.padding(start = 12.dp),
                                color = tint,
                                style = MaterialTheme.typography.bodyMedium
                            )
                        }
                    }
                }
            }
            item {
                SectionTitle("Record summary")
                SurfaceCard {
                    Column(modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp)) {
                        LabelValueRow("Last sync / upload", state.lastSynced)
                        LabelValueRow("Last batch queued", state.pendingRecords.toString())
                        LabelValueRow("Accepted by server", state.successfulRecords.toString())
                        LabelValueRow("Rejected records", state.failedRecords.toString())
                    }
                }
            }
            item {
                SectionTitle("Needs attention")
                SurfaceCard {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconBadge(Icons.Default.WarningIcon, Warning, Warning.copy(alpha = 0.1f), size = 40)
                        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                            Text("Call-log sync status", fontWeight = FontWeight.SemiBold)
                            Text(
                                if (state.callLogConsentAccepted && state.callLogPermissionGranted) {
                                    "This phone is eligible for sync when management starts it."
                                } else {
                                    "Accept the call-log notice and grant Android permission before management can sync."
                                },
                                color = TextSecondary,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
            item {
                SurfaceCard {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconBadge(Icons.AutoMirrored.Filled.List, BrandCyan, PaleBlue, size = 38)
                        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                            Text("Call metadata only", fontWeight = FontWeight.SemiBold)
                            Text(
                                "No audio or contact names are read. Demo call-history screens are separate from uploaded device records.",
                                color = TextSecondary,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        }
    }
}
