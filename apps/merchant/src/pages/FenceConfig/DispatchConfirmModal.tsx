// src/pages/DispatchConfirmModal.tsx
import React from 'react';
import {
  Modal,
  Button,
  Typography,
  Tooltip,
  Image,
} from 'antd';
import { CloseOutlined, RocketOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

interface DispatchConfirmModalProps {
  orderNo: string;
  fromAddress: string;
  toAddress: string;
  distance: string;
  duration: string;
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

const DispatchConfirmModal: React.FC<DispatchConfirmModalProps> = ({
  orderNo,
  fromAddress,
  toAddress,
  distance,
  duration,
  open,
  onCancel,
  onConfirm,
}) => {
  return (
    <Modal
      title={`订单发货确认: ${orderNo}`}
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          icon={<RocketOutlined />}
          onClick={onConfirm}
          style={{ backgroundColor: '#1890ff', borderColor: '#1890ff' }}
        >
          确认发货
        </Button>,
      ]}
      width={800}
      destroyOnClose
    >
      <div style={{ padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 发货地址 */}
          <div>
            <Text strong>发货地址 (商家仓):</Text>
            <Text style={{ marginLeft: 8 }}>{fromAddress}</Text>
          </div>

          {/* 收货地址 */}
          <div>
            <Text strong>收货地址 (用户):</Text>
            <Text style={{ marginLeft: 8 }}>{toAddress}</Text>
          </div>

          {/* 预计里程/时间 */}
          <div>
            <Text strong>预计里程/时间:</Text>
            <Text style={{ marginLeft: 8, color: '#1890ff', fontWeight: 500 }}>
              {distance} / {duration}
            </Text>
          </div>

          {/* 提示信息 */}
          <div
            style={{
              background: '#fff7d1',
              border: '1px solid #ffe58f',
              borderRadius: 4,
              padding: 12,
              fontSize: 12,
              color: '#d35b00',
              marginTop: 16,
            }}
          >
            <Text strong>提示：</Text>
            <Text>系统将基于高德地图自动规划最优路线</Text>
          </div>

          {/* 地图预览图 */}
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Image
              preview={false}
              src="https://via.placeholder.com/600x300?text=地图预览模式"
              alt="路线规划"
              style={{ width: '100%', maxWidth: 600, height: 150, objectFit: 'cover' }}
              placeholder={
                <div
                  style={{
                    width: '100%',
                    height: 150,
                    background: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#999',
                  }}
                >
                  地图加载中...
                </div>
              }
            />
            <Tooltip title="地图预览模式">
              <span style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                地图预览模式
              </span>
            </Tooltip>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default DispatchConfirmModal;