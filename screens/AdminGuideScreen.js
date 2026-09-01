import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CORE_FLOW_STEPS, ADMIN_WORKFLOWS } from '../utils/adminWorkflows';
import { useLanguage } from '../contexts/LanguageContext';
import { getTranslation } from '../utils/translations';

const DESKTOP_BREAKPOINT = 768;

function FlowArrow({ horizontal }) {
  return (
    <View style={[styles.flowArrowWrap, horizontal && styles.flowArrowWrapHorizontal]}>
      <Ionicons
        name={horizontal ? 'arrow-forward' : 'arrow-down'}
        size={horizontal ? 18 : 16}
        color="#94A3B8"
      />
    </View>
  );
}

function CoreFlowStep({ step, horizontal, isLast }) {
  const isWarning = step.warning;
  const isComplete = step.complete;

  return (
    <>
      <View
        style={[
          styles.coreStep,
          horizontal && styles.coreStepHorizontal,
          isWarning && styles.coreStepWarning,
          isComplete && styles.coreStepComplete,
        ]}
      >
        {isWarning && (
          <Ionicons name="warning-outline" size={16} color="#B91C1C" style={styles.coreStepIcon} />
        )}
        {isComplete && (
          <Ionicons name="checkmark-circle-outline" size={16} color="#059669" style={styles.coreStepIcon} />
        )}
        <Text
          style={[
            styles.coreStepText,
            isWarning && styles.coreStepTextWarning,
            isComplete && styles.coreStepTextComplete,
          ]}
        >
          {isWarning ? `⚠ ${step.label}` : step.label}
        </Text>
      </View>
      {!isLast && <FlowArrow horizontal={horizontal} />}
    </>
  );
}

function StepList({ steps, warningStepIndex }) {
  return (
    <View style={styles.stepList}>
      {steps.map((step, index) => {
        const isWarning = warningStepIndex === index;
        return (
          <View key={step} style={styles.stepRow}>
            <View style={[styles.stepNum, isWarning && styles.stepNumWarning]}>
              <Text style={[styles.stepNumText, isWarning && styles.stepNumTextWarning]}>
                {index + 1}
              </Text>
            </View>
            <Text style={[styles.stepLabel, isWarning && styles.stepLabelWarning]}>{step}</Text>
          </View>
        );
      })}
    </View>
  );
}

function WorkflowCard({ workflow, onNavigate, onLayoutSection }) {
  const isProminent = workflow.prominent;

  const handleAction = () => {
    if (!workflow.action) return;
    const { screen, params } = workflow.action;
    onNavigate(screen, params || null);
  };

  return (
    <View
      style={[styles.workflowCard, isProminent && styles.workflowCardProminent]}
      onLayout={onLayoutSection(workflow.id)}
    >
      <View style={styles.workflowHeader}>
        <Text style={styles.workflowNumber}>{workflow.number}</Text>
        <View style={styles.workflowHeaderText}>
          <Text style={[styles.workflowTitle, isProminent && styles.workflowTitleProminent]}>
            {workflow.title}
          </Text>
          <Text style={styles.workflowDescription}>{workflow.description}</Text>
        </View>
      </View>

      <StepList steps={workflow.steps} warningStepIndex={workflow.warningStepIndex} />

      {workflow.callout ? (
        <View style={styles.callout}>
          <View style={styles.calloutHeader}>
            <View style={styles.calloutDot} />
            <Text style={styles.calloutTitle}>{workflow.callout.title}</Text>
          </View>
          <Text style={styles.calloutIntro}>{workflow.callout.intro}</Text>
          {workflow.callout.bullets.map((bullet) => (
            <View key={bullet} style={styles.calloutBulletRow}>
              <Text style={styles.calloutBullet}>•</Text>
              <Text style={styles.calloutBulletText}>{bullet}</Text>
            </View>
          ))}
          <View style={styles.actionRequiredBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#B91C1C" />
            <Text style={styles.actionRequiredText}>
              ACTION REQUIRED — Assign a coach to every new customer booking.
            </Text>
          </View>
        </View>
      ) : null}

      {workflow.note ? <Text style={styles.workflowNote}>{workflow.note}</Text> : null}

      {workflow.action ? (
        <TouchableOpacity style={styles.actionBtn} onPress={handleAction} activeOpacity={0.8}>
          <Text style={styles.actionBtnText}>{workflow.action.label}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function AdminGuideScreen({ onNavigate, initialSection }) {
  const { width } = useWindowDimensions?.() ?? { width: 400 };
  const isDesktop = width >= DESKTOP_BREAKPOINT;
  const { language } = useLanguage();
  const t = (key) => getTranslation(language, key);

  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const [pendingScroll, setPendingScroll] = useState(initialSection || null);

  const onLayoutSection = useCallback(
    (id) => (e) => {
      sectionOffsets.current[id] = e.nativeEvent.layout.y;
      if (pendingScroll === id && scrollRef.current) {
        const y = Math.max(0, sectionOffsets.current[id] - 16);
        scrollRef.current.scrollTo({ y, animated: true });
        setPendingScroll(null);
      }
    },
    [pendingScroll]
  );

  useEffect(() => {
    if (!initialSection) return;
    setPendingScroll(initialSection);
    const y = sectionOffsets.current[initialSection];
    if (y != null && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, y - 16), animated: true });
      setPendingScroll(null);
    }
  }, [initialSection]);

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={[styles.content, isDesktop && styles.contentDesktop]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.pageHeader}>
        <Text style={styles.title}>{t('navAdminGuide')}</Text>
        <Text style={styles.subtitle}>How Airdrop Tennis works</Text>
      </View>

      <View style={styles.coreSection} onLayout={onLayoutSection('core')}>
        <Text style={styles.sectionLabel}>THE CORE FLOW</Text>
        <View style={[styles.coreFlow, isDesktop && styles.coreFlowHorizontal]}>
          {CORE_FLOW_STEPS.map((step, index) => (
            <CoreFlowStep
              key={step.key}
              step={step}
              horizontal={isDesktop}
              isLast={index === CORE_FLOW_STEPS.length - 1}
            />
          ))}
        </View>
      </View>

      <Text style={[styles.sectionLabel, styles.workflowsLabel]}>KEY WORKFLOWS</Text>

      {ADMIN_WORKFLOWS.map((workflow) => (
        <WorkflowCard
          key={workflow.id}
          workflow={workflow}
          onNavigate={onNavigate}
          onLayoutSection={onLayoutSection}
        />
      ))}

      {onNavigate && (
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => onNavigate('admin-dashboard')}
          activeOpacity={0.7}
        >
          <Ionicons name="grid-outline" size={18} color="#0D9488" />
          <Text style={styles.backBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  contentDesktop: {
    maxWidth: 800,
    alignSelf: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  pageHeader: {
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 15,
    color: '#6B7280',
    marginTop: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  workflowsLabel: {
    marginTop: 8,
    marginBottom: 16,
  },
  coreSection: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  coreFlow: {
    alignItems: 'stretch',
  },
  coreFlowHorizontal: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  coreStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#CCFBF1',
  },
  coreStepHorizontal: {
    flexShrink: 1,
    maxWidth: '100%',
  },
  coreStepWarning: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  coreStepComplete: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  coreStepIcon: {
    marginRight: 6,
  },
  coreStepText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0F766E',
    flexShrink: 1,
  },
  coreStepTextWarning: {
    color: '#B91C1C',
  },
  coreStepTextComplete: {
    color: '#047857',
  },
  flowArrowWrap: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  flowArrowWrapHorizontal: {
    paddingVertical: 0,
    paddingHorizontal: 6,
  },
  workflowCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  workflowCardProminent: {
    borderColor: '#FECACA',
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  workflowHeader: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  workflowNumber: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D9488',
    marginTop: 2,
    minWidth: 22,
  },
  workflowHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  workflowTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  workflowTitleProminent: {
    color: '#7F1D1D',
  },
  workflowDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 20,
  },
  stepList: {
    gap: 10,
    marginBottom: 4,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stepNum: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepNumWarning: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  stepNumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  stepNumTextWarning: {
    color: '#B91C1C',
  },
  stepLabel: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    fontWeight: '500',
  },
  stepLabelWarning: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  callout: {
    marginTop: 14,
    padding: 14,
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  calloutHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  calloutDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
  },
  calloutTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.4,
  },
  calloutIntro: {
    fontSize: 14,
    fontWeight: '600',
    color: '#78350F',
    marginBottom: 8,
  },
  calloutBulletRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    paddingLeft: 4,
  },
  calloutBullet: {
    fontSize: 14,
    color: '#92400E',
  },
  calloutBulletText: {
    flex: 1,
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  actionRequiredBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  actionRequiredText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
    lineHeight: 17,
  },
  workflowNote: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 12,
    fontStyle: 'italic',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 16,
    backgroundColor: '#0D9488',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0D9488',
  },
});
