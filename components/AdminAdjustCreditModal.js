import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  Platform,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { adminAdjustWallet } from '../lib/stripe';
import {
  CREDIT_ADJUSTMENT_REASONS,
  formatWalletAmount,
  mapWalletRpcError,
  parseWalletInput,
  roundWalletAmount,
} from '../utils/wallet';
import { getPhoneDisplayLabel } from '../utils/phone';

function ReasonPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <View style={styles.reasonWrap}>
      <TouchableOpacity style={styles.reasonButton} onPress={() => setOpen((v) => !v)}>
        <Text style={[styles.reasonButtonText, !value && styles.reasonPlaceholder]}>
          {value || 'Select reason'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </TouchableOpacity>
      {open && (
        <View style={styles.reasonMenu}>
          {CREDIT_ADJUSTMENT_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason}
              style={[styles.reasonItem, value === reason && styles.reasonItemActive]}
              onPress={() => {
                onChange(reason);
                setOpen(false);
              }}
            >
              <Text style={[styles.reasonItemText, value === reason && styles.reasonItemTextActive]}>
                {reason}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

export default function AdminAdjustCreditModal({ visible, student, onClose, onSuccess }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile = width <= 768;

  const [direction, setDirection] = useState('add');
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const currentBalance = roundWalletAmount(student?.walletBalance ?? 0);
  const parsedAmount = parseWalletInput(amountInput);
  const signedDelta =
    parsedAmount != null ? (direction === 'add' ? parsedAmount : -parsedAmount) : null;
  const newBalance =
    signedDelta != null ? roundWalletAmount(currentBalance + signedDelta) : currentBalance;

  useEffect(() => {
    if (!visible) return;
    setDirection('add');
    setAmountInput('');
    setReason('');
    setNote('');
    setStep('form');
    setSubmitting(false);
    setError(null);
    setSuccess(null);
  }, [visible, student?.id]);

  const canPreview = parsedAmount != null && reason && (reason !== 'Other' || note.trim());
  const confirmLabel =
    direction === 'add'
      ? `Add ${formatWalletAmount(parsedAmount || 0)}`
      : `Remove ${formatWalletAmount(parsedAmount || 0)}`;

  const handleConfirm = async () => {
    if (!student?.id || !parsedAmount || !reason) return;
    if (reason === 'Other' && !note.trim()) {
      setError('Please add a short note when reason is Other.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      const result = await adminAdjustWallet({
        userId: student.id,
        amount: parsedAmount,
        direction,
        reason,
        note: note.trim() || null,
      });
      setSuccess({
        delta: Number(result?.delta ?? signedDelta),
        balanceAfter: Number(result?.balance_after ?? newBalance),
      });
      setStep('success');
      onSuccess?.({
        studentId: student.id,
        balanceAfter: Number(result?.balance_after ?? newBalance),
      });
    } catch (err) {
      setError(mapWalletRpcError(err));
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  if (!student) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            isMobile && styles.sheetMobile,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          {step === 'success' ? (
            <View style={styles.successBody}>
              <Ionicons name="checkmark-circle" size={40} color="#0D9488" />
              <Text style={styles.successTitle}>Credit updated</Text>
              <Text style={styles.successStudent}>{student.fullName}</Text>
              <Text style={styles.successDelta}>
                {success?.delta >= 0 ? '+' : '−'}
                {formatWalletAmount(Math.abs(success?.delta || 0))}
              </Text>
              <Text style={styles.successBalanceLabel}>New balance</Text>
              <Text style={styles.successBalance}>{formatWalletAmount(success?.balanceAfter || 0)}</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={onClose}>
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <Text style={styles.title}>{step === 'confirm' ? 'Confirm adjustment' : 'Adjust credit'}</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={22} color="#64748B" />
                </TouchableOpacity>
              </View>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.studentName}>{student.fullName}</Text>
                <Text style={styles.studentMeta}>{student.email}</Text>
                <Text style={styles.studentMeta}>{getPhoneDisplayLabel(student.phone)}</Text>

                {step === 'confirm' ? (
                  <View style={styles.confirmCard}>
                    <Text style={styles.confirmQuestion}>
                      {direction === 'add' ? 'Add' : 'Remove'} {formatWalletAmount(parsedAmount || 0)} credit
                      {direction === 'add' ? ' to' : ' from'} {student.fullName}?
                    </Text>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Current balance</Text>
                      <Text style={styles.previewValue}>{formatWalletAmount(currentBalance)}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>New balance</Text>
                      <Text style={styles.previewValueStrong}>{formatWalletAmount(newBalance)}</Text>
                    </View>
                    <View style={styles.previewRow}>
                      <Text style={styles.previewLabel}>Reason</Text>
                      <Text style={styles.previewValue}>{reason}</Text>
                    </View>
                    {note.trim() ? (
                      <View style={styles.previewRow}>
                        <Text style={styles.previewLabel}>Note</Text>
                        <Text style={styles.previewValue}>{note.trim()}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : (
                  <>
                    <Text style={styles.fieldLabel}>Current balance</Text>
                    <Text style={styles.currentBalance}>{formatWalletAmount(currentBalance)}</Text>

                    <Text style={styles.fieldLabel}>Adjustment type</Text>
                    <View style={styles.toggleRow}>
                      <TouchableOpacity
                        style={[styles.toggleBtn, direction === 'add' && styles.toggleBtnActiveAdd]}
                        onPress={() => setDirection('add')}
                      >
                        <Text style={[styles.toggleText, direction === 'add' && styles.toggleTextActive]}>
                          Add credit
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.toggleBtn, direction === 'remove' && styles.toggleBtnActiveRemove]}
                        onPress={() => setDirection('remove')}
                      >
                        <Text style={[styles.toggleText, direction === 'remove' && styles.toggleTextActive]}>
                          Remove credit
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.fieldLabel}>Amount</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.amountPrefix}>$</Text>
                      <TextInput
                        style={styles.amountInput}
                        value={amountInput}
                        onChangeText={setAmountInput}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>

                    <Text style={styles.fieldLabel}>Reason</Text>
                    <ReasonPicker value={reason} onChange={setReason} />

                    <Text style={styles.fieldLabel}>Notes</Text>
                    <TextInput
                      style={[styles.input, styles.noteInput]}
                      value={note}
                      onChangeText={setNote}
                      placeholder="Optional internal note"
                      placeholderTextColor="#94A3B8"
                      multiline
                    />

                    {parsedAmount != null && (
                      <View style={styles.previewCard}>
                        <View style={styles.previewRow}>
                          <Text style={styles.previewLabel}>Current balance</Text>
                          <Text style={styles.previewValue}>{formatWalletAmount(currentBalance)}</Text>
                        </View>
                        <View style={styles.previewRow}>
                          <Text style={styles.previewLabel}>Adjustment</Text>
                          <Text
                            style={[
                              styles.previewValue,
                              direction === 'add' ? styles.previewPositive : styles.previewNegative,
                            ]}
                          >
                            {direction === 'add' ? '+' : '−'}
                            {formatWalletAmount(parsedAmount)}
                          </Text>
                        </View>
                        <View style={styles.previewDivider} />
                        <View style={styles.previewRow}>
                          <Text style={styles.previewLabelStrong}>New balance</Text>
                          <Text style={styles.previewValueStrong}>{formatWalletAmount(newBalance)}</Text>
                        </View>
                      </View>
                    )}
                  </>
                )}

                {error ? (
                  <View style={styles.errorBanner}>
                    <Ionicons name="alert-circle-outline" size={16} color="#DC2626" />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                ) : null}
              </ScrollView>

              <View style={styles.footer}>
                {step === 'confirm' ? (
                  <>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={() => setStep('form')} disabled={submitting}>
                      <Text style={styles.secondaryBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, submitting && styles.primaryBtnDisabled]}
                      onPress={handleConfirm}
                      disabled={submitting}
                    >
                      {submitting ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>{confirmLabel}</Text>
                      )}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
                      <Text style={styles.secondaryBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.primaryBtn, !canPreview && styles.primaryBtnDisabled]}
                      onPress={() => {
                        setError(null);
                        setStep('confirm');
                      }}
                      disabled={!canPreview}
                    >
                      <Text style={styles.primaryBtnText}>Review</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: 16,
  },
  sheet: {
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    ...(Platform.OS === 'web' && { boxShadow: '0 20px 40px rgba(15, 23, 42, 0.18)' }),
  },
  sheetMobile: {
    maxHeight: '92%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  scroll: { flexGrow: 0 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  studentMeta: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    marginTop: 14,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  currentBalance: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0D9488',
  },
  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  toggleBtnActiveAdd: {
    backgroundColor: '#1E3D32',
    borderColor: '#1E3D32',
  },
  toggleBtnActiveRemove: {
    backgroundColor: '#7F1D1D',
    borderColor: '#7F1D1D',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  toggleTextActive: {
    color: '#fff',
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
  },
  amountPrefix: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
    marginRight: 4,
  },
  amountInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#0F172A',
    paddingVertical: 12,
    ...(Platform.OS === 'web' && { outlineStyle: 'none' }),
  },
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#0F172A',
    backgroundColor: '#fff',
  },
  noteInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  reasonWrap: { position: 'relative', zIndex: 20 },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  reasonButtonText: { fontSize: 15, color: '#0F172A', flex: 1 },
  reasonPlaceholder: { color: '#94A3B8' },
  reasonMenu: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
  reasonItem: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  reasonItemActive: { backgroundColor: 'rgba(30, 61, 50, 0.06)' },
  reasonItemText: { fontSize: 14, color: '#334155' },
  reasonItemTextActive: { fontWeight: '600', color: '#1E3D32' },
  previewCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  confirmCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  confirmQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 4,
  },
  previewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  previewLabel: { fontSize: 13, color: '#64748B' },
  previewLabelStrong: { fontSize: 13, fontWeight: '600', color: '#334155' },
  previewValue: { fontSize: 14, color: '#0F172A' },
  previewValueStrong: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  previewPositive: { color: '#0D9488', fontWeight: '600' },
  previewNegative: { color: '#B45309', fontWeight: '600' },
  previewDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 6,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },
  errorText: { flex: 1, fontSize: 13, color: '#B91C1C' },
  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 15, fontWeight: '600', color: '#334155' },
  primaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#1E3D32',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  successBody: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 10,
  },
  successStudent: {
    fontSize: 15,
    color: '#64748B',
    marginTop: 4,
  },
  successDelta: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0D9488',
    marginTop: 12,
  },
  successBalanceLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  successBalance: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 20,
  },
});
