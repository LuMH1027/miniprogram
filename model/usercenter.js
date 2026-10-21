const userInfo = {
  avatarUrl:
    'https://we-retail-static-1300977798.cos.ap-guangzhou.myqcloud.com/retail-ui/components-exp/avatar/avatar-1.jpg',
  nickName: '云开发',
  phoneNumber: '13438358888',
  gender: 2,
};
export const genSimpleUserInfo = () => ({ ...userInfo });

export const genUsercenter = () => ({
  userInfo,
});
